package com.agriweather.service;

import com.agriweather.ai.EmbeddingProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 知识库向量化。
 *
 * 优先使用 OpenAI 兼容的 /embeddings 服务；没有配置时回退到本地字词哈希向量，
 * 保证「向量检索」这条链路在没有外部服务时也能工作。两种模式的向量用
 * embedding_model 区分，切换模型后旧向量会在重建索引前被忽略。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmbeddingService {

    public static final String LOCAL_MODEL = "local-hash-v1";
    private static final int LOCAL_DIM = 384;

    private final EmbeddingProperties properties;
    private final ObjectMapper objectMapper;
    private volatile HttpClient http;

    public boolean isExternalConfigured() {
        return properties.isConfigured();
    }

    public String modelName() {
        return properties.isConfigured() ? properties.getModel() : LOCAL_MODEL;
    }

    public String modeLabel() {
        return properties.isConfigured() ? "external" : "local";
    }

    public float[] embed(String text) {
        List<float[]> vectors = embed(List.of(text == null ? "" : text));
        return vectors.isEmpty() ? new float[0] : vectors.get(0);
    }

    public List<float[]> embed(List<String> texts) {
        if (texts == null || texts.isEmpty()) return List.of();
        if (properties.isConfigured()) {
            return embedExternal(texts);
        }
        List<float[]> result = new ArrayList<>(texts.size());
        for (String text : texts) result.add(localEmbed(text));
        return result;
    }

    private List<float[]> embedExternal(List<String> texts) {
        List<float[]> result = new ArrayList<>(texts.size());
        int batchSize = Math.max(1, Math.min(properties.getBatchSize(), 64));
        for (int start = 0; start < texts.size(); start += batchSize) {
            int end = Math.min(texts.size(), start + batchSize);
            result.addAll(callBatch(texts.subList(start, end)));
        }
        return result;
    }

    private List<float[]> callBatch(List<String> batch) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", properties.getModel());
            body.put("input", batch);
            body.put("encoding_format", "float");

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint()))
                    .timeout(Duration.ofSeconds(Math.max(5, properties.getTimeoutSeconds())))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + properties.getApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new EmbeddingException("Embedding 服务返回 HTTP " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode data = root.path("data");
            if (!data.isArray() || data.size() != batch.size()) {
                throw new EmbeddingException("Embedding 服务返回数量不匹配");
            }
            List<Map.Entry<Integer, float[]>> ordered = new ArrayList<>();
            for (JsonNode item : data) {
                int index = item.path("index").asInt(ordered.size());
                JsonNode embedding = item.path("embedding");
                float[] vector = new float[embedding.size()];
                for (int i = 0; i < embedding.size(); i++) {
                    vector[i] = (float) embedding.get(i).asDouble();
                }
                ordered.add(Map.entry(index, vector));
            }
            ordered.sort(Comparator.comparingInt(Map.Entry::getKey));
            return ordered.stream().map(Map.Entry::getValue).toList();
        } catch (EmbeddingException e) {
            throw e;
        } catch (Exception e) {
            throw new EmbeddingException("Embedding 调用失败：" + e.getMessage());
        }
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

    private String endpoint() {
        String base = properties.getBaseUrl().trim();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + "/embeddings";
    }

    /** 本地字词哈希向量：中文 bigram / 英文词做带符号哈希，L2 归一化 */
    private float[] localEmbed(String text) {
        float[] vector = new float[LOCAL_DIM];
        Map<String, Integer> terms = ChineseTextTokenizer.termCounts(text);
        for (Map.Entry<String, Integer> entry : terms.entrySet()) {
            int hash = entry.getKey().hashCode();
            int index = Math.floorMod(hash, LOCAL_DIM);
            float sign = (hash & 0x80000000) == 0 ? 1f : -1f;
            vector[index] += sign * (1f + (float) Math.log(entry.getValue()));
        }
        return normalize(vector);
    }

    private float[] normalize(float[] vector) {
        double norm = 0;
        for (float v : vector) norm += v * v;
        if (norm <= 0) return vector;
        double len = Math.sqrt(norm);
        for (int i = 0; i < vector.length; i++) vector[i] = (float) (vector[i] / len);
        return vector;
    }

    public static byte[] toBytes(float[] vector) {
        if (vector == null || vector.length == 0) return null;
        ByteBuffer buffer = ByteBuffer.allocate(vector.length * 4).order(ByteOrder.LITTLE_ENDIAN);
        for (float value : vector) buffer.putFloat(value);
        return buffer.array();
    }

    public static float[] fromBytes(byte[] bytes) {
        if (bytes == null || bytes.length == 0 || bytes.length % 4 != 0) return null;
        float[] vector = new float[bytes.length / 4];
        ByteBuffer buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < vector.length; i++) vector[i] = buffer.getFloat();
        return vector;
    }

    public static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length == 0 || a.length != b.length) return 0;
        double dot = 0;
        double na = 0;
        double nb = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        if (na <= 0 || nb <= 0) return 0;
        return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    public static class EmbeddingException extends RuntimeException {
        public EmbeddingException(String message) {
            super(message);
        }
    }
}