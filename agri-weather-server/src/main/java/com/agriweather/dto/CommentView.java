package com.agriweather.dto;

public record CommentView(
        Long id,
        String content,
        String author,
        String authorAvatar,
        Long authorId,
        String createdAt
) {
}
