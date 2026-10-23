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
        /** 封面原始宽高，前端据此做瀑布流比例（缺失时前端回退 4:5） */
        Integer coverWidth,
        Integer coverHeight,
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