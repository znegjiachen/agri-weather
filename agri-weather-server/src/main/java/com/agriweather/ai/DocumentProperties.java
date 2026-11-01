package com.agriweather.ai;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 对话文档检索配置 */
@Data
@ConfigurationProperties(prefix = "app.document")
public class DocumentProperties {

    /** 文档保留天数，过期后定时清理 */
    private int ttlDays = 7;

    /** 单篇文档最多索引的片段数，避免一次上传产生过多 embedding 调用 */
    private int maxChunks = 120;

    /** 每轮对话注入的片段数 */
    private int topK = 4;

    /** 注入片段的字符上限 */
    private int maxBlockChars = 2400;
}