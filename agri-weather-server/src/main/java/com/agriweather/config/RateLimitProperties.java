package com.agriweather.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** 按分钟限流，防止登录爆破、AI 调用被刷和上传滥用 */
@Data
@Component
@ConfigurationProperties(prefix = "app.rate-limit")
public class RateLimitProperties {

    private boolean enabled = true;

    /** 登录/注册：每 IP 每分钟 */
    private int authPerMinute = 20;

    /** 智能体对话/语音转写/视觉：每用户或 IP 每分钟 */
    private int agentPerMinute = 10;

    /** 文档解析/上传：每用户或 IP 每分钟 */
    private int uploadPerMinute = 6;
}