package com.agriweather.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;

/**
 * OpenAI 兼容语音转写客户端。
 *
 * 使用 multipart 提交音频，解析响应里的 text 字段。
 * 未配置时由 Controller 返回可解释的 503，前端可以回退到浏览器语音识别。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AsrClient {

    private final AsrProperties properties;
    private final ObjectMapper mapper;
    private volatile HttpClient http;

    public boolean isConfigured() {
        return properties.isConfigured();
    }

    public String model() {
        return properties.getModel();
    }

    public String transcribe(byte[] audio, String filename, String contentType) {
        if (!properties.isConfigured()) {
            throw new IllegalStateException("未配置语音识别服务");
        }
        if (audio == null || audio.length == 0) {
            throw new IllegalArgumentException("音频内容为空");
        }

        String boundary = "----AgriAsr" + UUID.randomUUID().toString().replace("-", "");
        byte[] body;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            writeFilePart(out, boundary, "file", filename, contentType, audio);
            writeTextPart(out, boundary, "model", properties.getModel());
            if (properties.getLanguage() != null && !properties.getLanguage().isBlank()) {
                writeTextPart(out, boundary, "language", properties.getLanguage());
            }
            writeTextPart(out, boundary, "response_format", "json");
            out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            body = out.toByteArray();
        } catch (IOException e) {
            throw new AsrException("组装音频请求失败", e);
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint()))
                .timeout(Duration.ofSeconds(Math.max(10, properties.getTimeoutSeconds())))
                .header("Authorization", "Bearer " + properties.getApiKey())
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        try {
            HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new AsrException("语音识别服务返回 HTTP " + response.statusCode()
                        + "：" + truncate(response.body(), 300));
            }
            JsonNode root = mapper.readTree(response.body());
            String text = root.path("text").asText("").trim();
            if (text.isEmpty()) {
                throw new AsrException("语音识别没有返回文字");
            }
            return text;
        } catch (AsrException e) {
            throw e;
        } catch (Exception e) {
            throw new AsrException("语音识别调用失败：" + e.getMessage(), e);
        }
    }

    private String endpoint() {
        String base = properties.getBaseUrl().trim();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + "/audio/transcriptions";
    }

    private HttpClient client() {
        HttpClient current = http;
        if (current == null) {
            synchronized (this) {
                if (http == null) {
                    http = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(10))
                            .build();
                }
                current = http;
            }
        }
        return current;
    }

    private void writeFilePart(ByteArrayOutputStream out, String boundary, String name,
                               String filename, String contentType, byte[] data) throws IOException {
        String safeName = filename == null || filename.isBlank() ? "recording.webm" : filename;
        String mime = contentType == null || contentType.isBlank() ? "audio/webm" : contentType;
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + name
                + "\"; filename=\"" + safeName.replace("\"", "") + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Type: " + mime + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(data);
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void writeTextPart(ByteArrayOutputStream out, String boundary,
                               String name, String value) throws IOException {
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n")
                .getBytes(StandardCharsets.UTF_8));
        out.write(value.getBytes(StandardCharsets.UTF_8));
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private String truncate(String text, int max) {
        if (text == null) return "";
        return text.length() <= max ? text : text.substring(0, max) + "…";
    }

    public static class AsrException extends RuntimeException {
        public AsrException(String message) {
            super(message);
        }

        public AsrException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}