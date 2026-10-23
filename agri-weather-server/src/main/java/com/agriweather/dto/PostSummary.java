package com.agriweather.dto;

/**
 * 社区列表项。
 *
 * 列表页只需要摘要和封面，不下发完整富文本：
 * HTML 里可能带 9 张图的标签，整页 20 条会白白放大响应体。
 */
public record PostSummary(
        Long id,
        String title,
        String excerpt,
        String coverImage,
        String contentFormat,
        String category,
        int likeCount,
        int commentCount,
        boolean liked,
        String author,
        Long authorId,
        String createdAt
) {
}