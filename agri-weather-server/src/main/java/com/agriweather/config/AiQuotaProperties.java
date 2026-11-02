package com.agriweather.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** 每用户每日 AI 问答额度，防止单个账号持续消耗模型费用 */
@Data
@Component
@ConfigurationProperties(prefix = "app.ai")
public class AiQuotaProperties {

    private boolean quotaEnabled = true;

    /** 每日对话/流式请求上限，0 表示不限制 */
    private int dailyChatQuota = 80;
}