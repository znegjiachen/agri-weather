package com.agriweather.ai;

import com.agriweather.dto.AgentVisionResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 植物照片识别客户端（OpenAI 兼容的多模态协议）。
 *
 * 只负责「图片 + 提示词 → 结构化识别结果」，
 * 后续结合天气/地块/农事工具的回答由文本智能体完成。
 */
@Slf4j
@RequiredArgsConstructor
public class VisionClient {

    public record ImageInput(byte[] data, String mimeType) {
    }

    private static final String SYSTEM_PROMPT = """
            你是「AgriChat」的植物视觉识别模块，服务中国农户。
            请分析用户上传的作物照片，判断植物名称、生长阶段、健康状态，
            以及可见的病害、虫害、缺素或环境胁迫。

            只输出一个 JSON 对象，不要 markdown 代码块，不要额外解释。字段：
            {
              "plantName": "植物/作物常用中文名，无法确定写 未识别",
              "scientificName": "学名，不确定写空字符串",
              "growthStage": "苗期/营养生长期/开花期/结果期/成熟期/无法判断",
              "healthStatus": "健康/轻微异常/明显异常/无法判断",
              "issues": [
                {
                  "type": "disease|pest|nutrient|environment|unknown",
                  "name": "问题名称",
                  "confidence": 0.0,
                  "symptoms": "图片中可见的症状",
                  "suggestion": "通用防治方向"
                }
              ],
              "overallAssessment": "一段话综合判断",
              "careAdvice": ["3-5 条具体可执行的建议"]
            }

            要求：
            - 只依据图片中可见的证据判断；不确定时降低 confidence 并写明不确定原因。
            - 无法识别植物时 plantName 写 未识别，不要猜测。
            - 没有明显问题时 issues 返回空数组，healthStatus 写 健康。
            - 涉及农药只给通用方向，提醒按产品标签使用并咨询当地农技员，不要编造浓度或剂量。
            """;

    private final VisionProperties props;
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

    @SuppressWarnings("unchecked")
    public AgentVisionResponse analyze(List<ImageInput> images, String note) {
        if (!props.isConfigured()) {
            throw new IllegalStateException("未配置视觉模型 API Key，请设置 VISION_API_KEY 或 DEEPSEEK_API_KEY");
        }
        if (images == null || images.isEmpty()) {
            throw new IllegalArgumentException("请至少上传一张作物照片");
        }

        List<Map<String, Object>> content = new ArrayList<>();
        Map<String, Object> textPart = new LinkedHashMap<>();
        textPart.put("type", "text");
        textPart.put("text", SYSTEM_PROMPT
                + "\n用户备注：" + (note == null || note.isBlank() ? "无" : note.trim()));
        content.add(textPart);

        for (ImageInput image : images) {
            Map<String, Object> imageUrl = new LinkedHashMap<>();
            imageUrl.put("url", "data:" + image.mimeType() + ";base64,"
                    + Base64.getEncoder().encodeToString(image.data()));
            Map<String, Object> imagePart = new LinkedHashMap<>();
            imagePart.put("type", "image_url");
            imagePart.put("image_url", imageUrl);
            content.add(imagePart);
        }

        Map<String, Object> userMessage = new LinkedHashMap<>();
        userMessage.put("role", "user");
        userMessage.put("content", content);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", props.getModel());
        body.put("messages", List.of(userMessage));
        body.put("temperature", 0.1);
        body.put("max_tokens", props.getMaxTokens());
        body.put("stream", false);

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
            throw new VisionException(describeHttpError(e), e);
        } catch (Exception e) {
            throw new VisionException("调用视觉模型失败：" + e.getMessage(), e);
        }

        try {
            Map<String, Object> root = mapper.readValue(raw, Map.class);
            List<Map<String, Object>> choices = (List<Map<String, Object>>) root.get("choices");
            if (choices == null || choices.isEmpty()) {
                throw new VisionException("视觉模型返回了空结果");
            }
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String contentText = message == null ? null : (String) message.get("content");
            if (contentText == null || contentText.isBlank()) {
                contentText = message == null ? null : (String) message.get("reasoning_content");
            }
            if (contentText == null || contentText.isBlank()) {
                throw new VisionException("视觉模型未返回识别结果");
            }
            return parse(contentText, props.getModel(), images.size());
        } catch (VisionException e) {
            throw e;
        } catch (Exception e) {
            throw new VisionException("解析视觉模型结果失败：" + e.getMessage(), e);
        }
    }

    /** 容忍模型偶尔输出 markdown 代码块；解析失败时退化为纯文本结论 */
    static AgentVisionResponse parse(String raw, String model, int imageCount) {
        ObjectMapper parser = new ObjectMapper();
        String cleaned = stripFence(raw);
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) {
            cleaned = cleaned.substring(start, end + 1);
        }

        try {
            JsonNode root = parser.readTree(cleaned);
            String plantName = text(root, "plantName", "未识别");
            String scientificName = text(root, "scientificName", "");
            String growthStage = text(root, "growthStage", "无法判断");
            String healthStatus = text(root, "healthStatus", "无法判断");
            String assessment = text(root, "overallAssessment", "");

            List<AgentVisionResponse.Issue> issues = new ArrayList<>();
            JsonNode issueNodes = root.path("issues");
            if (issueNodes.isArray()) {
                for (JsonNode node : issueNodes) {
                    if (issues.size() >= 4) break;
                    JsonNode confidence = node.path("confidence");
                    issues.add(new AgentVisionResponse.Issue(
                            text(node, "type", "unknown"),
                            text(node, "name", ""),
                            confidence.isNumber() ? confidence.asDouble() : null,
                            text(node, "symptoms", ""),
                            text(node, "suggestion", "")));
                }
            }

            List<String> advice = new ArrayList<>();
            JsonNode adviceNodes = root.path("careAdvice");
            if (adviceNodes.isArray()) {
                for (JsonNode node : adviceNodes) {
                    if (advice.size() >= 6) break;
                    if (!node.asText().isBlank()) advice.add(node.asText());
                }
            }

            return new AgentVisionResponse(
                    plantName, scientificName, growthStage, healthStatus,
                    issues, assessment, advice, model, imageCount);
        } catch (Exception e) {
            log.warn("视觉结果不是合法 JSON，退化为文本：{}", e.getMessage());
            return new AgentVisionResponse(
                    "未识别", "", "无法判断", "无法判断", List.of(),
                    raw.trim(), List.of("图片识别结果格式异常，建议换一张更清晰的照片重试"),
                    model, imageCount);
        }
    }

    private static String stripFence(String raw) {
        String text = raw == null ? "" : raw.trim();
        if (text.startsWith("```")) {
            int firstNewline = text.indexOf('\n');
            if (firstNewline >= 0) text = text.substring(firstNewline + 1);
            if (text.endsWith("```")) text = text.substring(0, text.length() - 3);
        }
        return text.trim();
    }

    private static String text(JsonNode node, String field, String fallback) {
        JsonNode value = node.path(field);
        return value.isTextual() && !value.asText().isBlank() ? value.asText().trim() : fallback;
    }

    private String describeHttpError(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String hint = switch (status) {
            case 401 -> "视觉模型 API Key 无效或已失效";
            case 402 -> "DeepSeek 账户余额不足，请充值";
            case 429 -> "视觉识别请求过于频繁，请稍后重试";
            case 400 -> "视觉模型请求参数有误（可能是模型名不可用或图片格式不支持）";
            case 500, 502, 503 -> "视觉模型服务暂时不可用，请稍后重试";
            default -> "视觉模型接口返回异常";
        };
        log.warn("Vision HTTP {}: {}", status, e.getResponseBodyAsString());
        return hint + "（HTTP " + status + "）";
    }

    public static class VisionException extends RuntimeException {
        public VisionException(String message) {
            super(message);
        }

        public VisionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}