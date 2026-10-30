package com.agriweather.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 外部 Embedding 服务（OpenAI 兼容 /embeddings）。
 *
 * 不配置时使用本地字词哈希向量（无需外部服务）；配置后新文档和重建索引会使用外部模型。
 */
@Data
@ConfigurationProperties(prefix = "app.embedding")
public class EmbeddingProperties {

    private String baseUrl = "";
    private String apiKey = "";
    private String model = "";
    private int timeoutSeconds = 30;
    private int batchSize = 16;

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank()
                && apiKey != null && !apiKey.isBlank()
                && model != null && !model.isBlank();
    }
}