package com.agriweather.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 植物视觉识别模型配置，对应 application.yml 的 app.vision */
@Data
@ConfigurationProperties(prefix = "app.vision")
public class VisionProperties {

    /** 默认复用 DeepSeek Key；也可以单独配置 VISION_API_KEY */
    private String apiKey = "";

    private String baseUrl = "https://api.deepseek.com";

    /** DeepSeek 视觉模型 */
    private String model = "deepseek-v4-flash-vision-exp";

    private int timeoutSeconds = 120;

    /** 视觉模型会先推理再输出 JSON，预留足够 token */
    private int maxTokens = 3000;

    private int maxImages = 3;

    private long maxImageBytes = 5L * 1024 * 1024;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}