package com.agriweather.dto;

import java.time.LocalDateTime;

/** 知识库文档列表项（不含正文） */
public record KnowledgeDocView(
        Long id,
        String title,
        String sourceType,
        String originalFilename,
        Integer byteSize,
        Integer charCount,
        long chunkCount,
        LocalDateTime createdAt
) {
}