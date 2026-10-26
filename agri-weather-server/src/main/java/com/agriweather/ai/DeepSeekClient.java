package com.agriweather.ai;

import com.agriweather.agent.ChatCompletion;
import com.agriweather.agent.ChatModel;
import com.agriweather.agent.ChatStreamListener;
import com.agriweather.agent.ToolCall;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * DeepSeek 对话客户端（OpenAI 兼容协议）
 *
 * 支持普通补全和流式补全：
 * - 普通补全用于同步 /chat
 * - 流式补全把 reasoning_content / content 增量实时回调，并累积 tool_calls 分片
 */
@Slf4j
@RequiredArgsConstructor
public class DeepSeekClient implements ChatModel {

    private final DeepSeekProperties props;
    private final ObjectMapper mapper;

    private RestClient restClient;

    private RestClient client() {
        if (restClient == null) {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(10_000);
            factory.setReadTimeout(props.getTimeoutSeconds() * 1000);
            restClient = RestClient.builder()
                    .baseUrl(props.getBaseUrl())
                    .requestFactory(factory)
                    .build();
        }
        return restClient;
    }

    private Map<String, Object> buildBody(List<Map<String, Object>> messages,
                                          List<Map<String, Object>> tools,
                                          boolean stream) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", props.getModel());
        body.put("messages", messages);
        body.put("temperature", props.getTemperature());
        body.put("max_tokens", props.getMaxTokens());
        body.put("stream", stream);
        if (tools != null && !tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }
        return body;
    }

    @Override
    @SuppressWarnings("unchecked")
    public ChatCompletion chat(List<Map<String, Object>> messages, List<Map<String, Object>> tools) {
        if (!props.isConfigured()) {
            throw new IllegalStateException("未配置 DeepSeek API Key，请设置环境变量 DEEPSEEK_API_KEY");
        }

        String raw;
        try {
            raw = client().post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + props.getApiKey())
                    .body(buildBody(messages, tools, false))
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException e) {
            throw new DeepSeekException(describeHttpError(e), e);
        } catch (Exception e) {
            throw new DeepSeekException("调用 DeepSeek 失败：" + e.getMessage(), e);
        }

        Map<String, Object> root;
        try {
            root = mapper.readValue(raw, Map.class);
        } catch (Exception e) {
            throw new DeepSeekException("解析 DeepSeek 响应失败：" + e.getMessage(), e);
        }

        List<Map<String, Object>> choices = (List<Map<String, Object>>) root.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new DeepSeekException("DeepSeek 返回了空结果：" + raw);
        }

        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        if (message == null) {
            throw new DeepSeekException("DeepSeek 响应缺少 message 字段：" + raw);
        }

        String content = (String) message.get("content");
        // reasoner 模型会返回内部思考；只用于展示，不回传上游
        String reasoning = (String) message.get("reasoning_content");

        List<ToolCall> toolCalls = new ArrayList<>();
        Object rawToolCalls = message.get("tool_calls");
        if (rawToolCalls instanceof List<?> list) {
            for (Object o : list) {
                Map<String, Object> tc = (Map<String, Object>) o;
                Map<String, Object> fn = (Map<String, Object>) tc.get("function");
                if (fn == null) continue;
                toolCalls.add(new ToolCall(
                        (String) tc.get("id"),
                        (String) fn.get("name"),
                        (String) fn.get("arguments")
                ));
            }
        }

        Map<String, Object> assistantMessage = new LinkedHashMap<>(message);
        assistantMessage.remove("reasoning_content");

        return new ChatCompletion(content, reasoning, toolCalls, assistantMessage);
    }

    @Override
    public ChatCompletion chatStream(List<Map<String, Object>> messages,
                                     List<Map<String, Object>> tools,
                                     ChatStreamListener listener) {
        if (!props.isConfigured()) {
            throw new IllegalStateException("未配置 DeepSeek API Key，请设置环境变量 DEEPSEEK_API_KEY");
        }

        Map<String, Object> body = buildBody(messages, tools, true);
        try {
            return client().post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + props.getApiKey())
                    .body(body)
                    .exchange((request, response) -> {
                        int status = response.getStatusCode().value();
                        if (status < 200 || status >= 300) {
                            String detail = new String(response.getBody().readAllBytes(),
                                    StandardCharsets.UTF_8);
                            throw new DeepSeekException(describeHttpError(status, detail));
                        }
                        return readStream(response.getBody(), listener);
                    });
        } catch (DeepSeekException e) {
            throw e;
        } catch (Exception e) {
            throw new DeepSeekException("调用 DeepSeek 流式接口失败：" + e.getMessage(), e);
        }
    }

    /** 读取 `data: {...}` SSE 行，累积 content / reasoning / tool_calls 分片 */
    private ChatCompletion readStream(InputStream stream, ChatStreamListener listener) throws IOException {
        StringBuilder reasoning = new StringBuilder();
        StringBuilder content = new StringBuilder();
        Map<Integer, ToolCallBuilder> callBuilders = new TreeMap<>();
        String finishReason = null;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("data:")) continue;
                String data = line.substring(5).trim();
                if (data.isEmpty()) continue;
                if ("[DONE]".equals(data)) break;

                JsonNode chunk = mapper.readTree(data);
                JsonNode choice = chunk.path("choices").path(0);
                JsonNode delta = choice.path("delta");

                String reasoningDelta = textOrNull(delta, "reasoning_content");
                if (reasoningDelta != null && !reasoningDelta.isEmpty()) {
                    reasoning.append(reasoningDelta);
                    listener.onReasoningDelta(reasoningDelta);
                }

                String contentDelta = textOrNull(delta, "content");
                if (contentDelta != null && !contentDelta.isEmpty()) {
                    content.append(contentDelta);
                    listener.onContentDelta(contentDelta);
                }

                JsonNode toolCallNodes = delta.path("tool_calls");
                if (toolCallNodes.isArray()) {
                    for (JsonNode node : toolCallNodes) {
                        int index = node.path("index").asInt(0);
                        ToolCallBuilder builder = callBuilders.computeIfAbsent(
                                index, i -> new ToolCallBuilder());
                        if (node.hasNonNull("id")) builder.id = node.get("id").asText();
                        JsonNode fn = node.path("function");
                        if (fn.hasNonNull("name")) builder.name = fn.get("name").asText();
                        if (fn.hasNonNull("arguments")) {
                            builder.arguments.append(fn.get("arguments").asText());
                        }
                    }
                }

                if (choice.hasNonNull("finish_reason")) {
                    finishReason = choice.get("finish_reason").asText();
                }
            }
        }

        List<ToolCall> toolCalls = new ArrayList<>();
        List<Map<String, Object>> rawToolCalls = new ArrayList<>();
        for (ToolCallBuilder builder : callBuilders.values()) {
            String args = builder.arguments.toString();
            toolCalls.add(new ToolCall(builder.id, builder.name, args));

            Map<String, Object> function = new LinkedHashMap<>();
            function.put("name", builder.name);
            function.put("arguments", args);
            Map<String, Object> raw = new LinkedHashMap<>();
            raw.put("id", builder.id);
            raw.put("type", "function");
            raw.put("function", function);
            rawToolCalls.add(raw);
        }

        Map<String, Object> assistantMessage = new LinkedHashMap<>();
        assistantMessage.put("role", "assistant");
        assistantMessage.put("content", content.length() > 0 ? content.toString() : null);
        if (!rawToolCalls.isEmpty()) {
            assistantMessage.put("tool_calls", rawToolCalls);
        }

        if ("length".equals(finishReason)) {
            log.warn("DeepSeek 流式回复因 max_tokens 截断");
        }

        return new ChatCompletion(
                content.length() > 0 ? content.toString() : null,
                reasoning.length() > 0 ? reasoning.toString() : null,
                toolCalls,
                assistantMessage);
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static class ToolCallBuilder {
        private String id;
        private String name;
        private final StringBuilder arguments = new StringBuilder();
    }

    /** 把上游 HTTP 错误翻译成人能看懂的中文 */
    private String describeHttpError(RestClientResponseException e) {
        return describeHttpError(e.getStatusCode().value(), e.getResponseBodyAsString());
    }

    private String describeHttpError(int status, String detail) {
        String hint = switch (status) {
            case 401 -> "API Key 无效或已失效，请检查 DEEPSEEK_API_KEY";
            case 402 -> "DeepSeek 账户余额不足，请充值";
            case 429 -> "请求过于频繁，已被限流，请稍后重试";
            case 400 -> "请求参数有误（可能是模型名不存在或消息格式错误）";
            case 500, 502, 503 -> "DeepSeek 服务端暂时不可用，请稍后重试";
            default -> "DeepSeek 接口返回异常";
        };
        log.warn("DeepSeek HTTP {}: {}", status, detail);
        return hint + "（HTTP " + status + "）";
    }

    /** 业务层可直接捕获并转成友好提示 */
    public static class DeepSeekException extends RuntimeException {
        public DeepSeekException(String message) {
            super(message);
        }

        public DeepSeekException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}