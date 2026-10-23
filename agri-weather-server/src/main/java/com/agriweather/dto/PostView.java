package com.agriweather.dto;

/** 社区帖子对外视图（不含任何 JPA 关联对象，避免序列化时的懒加载问题） */
public record PostView(
        Long id,
        String title,
        String content,
        /** TEXT / HTML，前端据此决定按纯文本还是富文本渲染 */
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