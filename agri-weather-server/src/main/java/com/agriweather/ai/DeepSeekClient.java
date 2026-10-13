package com.agriweather.ai;

import com.agriweather.agent.ChatCompletion;
import com.agriweather.agent.ChatModel;
import com.agriweather.agent.ToolCall;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DeepSeek 对话客户端（OpenAI 兼容协议）
 *
 * 只做一件事：发消息、收回复，支持 function calling —— 即 {@link ChatModel} 的一个实现。
 * 不含任何业务逻辑，也不含智能体循环 —— 那是 AgentHarness 与各 Tool 实现的职责。
 *
 * 没有 Spring 注解：由 {@link AgentAutoConfiguration} 显式装配成 Bean，
 * 这样它也能在纯 Java 环境（如单元测试）里直接 new 出来。
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

    /**
     * 发起一次对话补全
     *
     * @param messages 对话历史（含 system / user / assistant / tool）
     * @param tools    可用工具定义，传 null 表示禁止调用工具
     */
    @Override
    @SuppressWarnings("unchecked")
    public ChatCompletion chat(List<Map<String, Object>> messages, List<Map<String, Object>> tools) {
        if (!props.isConfigured()) {
            throw new IllegalStateException("未配置 DeepSeek API Key，请设置环境变量 DEEPSEEK_API_KEY");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", props.getModel());
        body.put("messages", messages);
        body.put("temperature", props.getTemperature());
        body.put("max_tokens", props.getMaxTokens());
        body.put("stream", false);
        if (tools != null && !tools.isEmpty()) {
            body.put("tools", tools);
            body.put("tool_choice", "auto");
        }

        String raw;
        try {
            raw = client().post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + props.getApiKey())
                    .body(body)
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

        return new ChatCompletion(content, toolCalls, message);
    }

    /** 把上游 HTTP 错误翻译成人能看懂的中文 */
    private String describeHttpError(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String detail = e.getResponseBodyAsString();
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
