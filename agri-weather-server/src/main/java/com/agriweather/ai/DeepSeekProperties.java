package com.agriweather.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * DeepSeek 模型配置，对应 application.yml 的 app.deepseek 节点
 */
@Data
@Component
@ConfigurationProperties(prefix = "app.deepseek")
public class DeepSeekProperties {

    /** API Key，建议用环境变量 DEEPSEEK_API_KEY 注入，不要写死在配置文件里 */
    private String apiKey = "";

    /** 接口地址，兼容 OpenAI 协议的中转服务改这里即可 */
    private String baseUrl = "https://api.deepseek.com";

    /** 模型名：deepseek-chat（V3 通用）/ deepseek-reasoner（R1 推理） */
    private String model = "deepseek-chat";

    /** 工具调用最大轮数，防止模型无限循环调用工具 */
    private int maxIterations = 6;

    /** 单次请求超时（秒） */
    private int timeoutSeconds = 60;

    /** 温度：农事建议需要稳定，不宜过高 */
    private double temperature = 0.3;

    /** 单次回复最大 token */
    private int maxTokens = 2048;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
