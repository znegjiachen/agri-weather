package com.agriweather.push;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Web Push 配置。
 *
 * public/private 是 base64url 的 VAPID 密钥；未配置时推送关闭，
 * 前端会显示“服务端未配置推送”，不影响其他功能。
 */
@Data
@ConfigurationProperties(prefix = "app.push")
public class PushProperties {

    private String publicKey = "";
    private String privateKey = "";
    private String subject = "mailto:admin@example.com";

    public boolean isConfigured() {
        return publicKey != null && !publicKey.isBlank()
                && privateKey != null && !privateKey.isBlank();
    }
}