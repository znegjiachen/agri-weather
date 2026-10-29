package com.agriweather.dto;

import java.time.LocalDateTime;

/** 单篇知识库文档全文（控制台查看用） */
public record KnowledgeDocDetail(
        Long id,
        String title,
        String sourceType,
        String originalFilename,
        Integer charCount,
        String content,
        LocalDateTime createdAt
) {
}