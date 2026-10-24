package com.agriweather.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * DeepSeek 模型配置，对应 application.yml 的 app.deepseek 节点
 *
 * 不加 @Component：由 {@link AgentAutoConfiguration} 上的
 * @EnableConfigurationProperties 注册成 Bean，这样在纯 Java 环境里也能直接 new。
 */
@Data
@ConfigurationProperties(prefix = "app.deepseek")
public class DeepSeekProperties {

    /** API Key，建议用环境变量 DEEPSEEK_API_KEY 注入，不要写死在配置文件里 */
    private String apiKey = "";

    /** 接口地址，兼容 OpenAI 协议的中转服务改这里即可 */
    private String baseUrl = "https://api.deepseek.com";

    /** 模型名：deepseek-reasoner（默认，支持工具调用并返回思考内容）/ deepseek-chat */
    private String model = "deepseek-reasoner";

    /** 工具调用最大轮数，防止模型无限循环调用工具 */
    private int maxIterations = 6;

    /** 单次请求超时（秒） */
    private int timeoutSeconds = 120;

    /** 温度：农事建议需要稳定，不宜过高 */
    private double temperature = 0.3;

    /** 单次回复最大 token（reasoner 的思考 token 也算在内） */
    private int maxTokens = 4096;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
