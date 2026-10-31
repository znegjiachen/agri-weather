package com.agriweather.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 语音识别服务（OpenAI 兼容 /audio/transcriptions）。
 *
 * 讯飞、阿里等厂商如果不直接兼容该协议，可在中间加一层适配，或使用浏览器语音识别回退。
 */
@Data
@ConfigurationProperties(prefix = "app.asr")
public class AsrProperties {

    private String baseUrl = "";
    private String apiKey = "";
    private String model = "whisper-1";
    private String language = "zh";
    private int timeoutSeconds = 60;

    public boolean isConfigured() {
        return baseUrl != null && !baseUrl.isBlank()
                && apiKey != null && !apiKey.isBlank()
                && model != null && !model.isBlank();
    }
}