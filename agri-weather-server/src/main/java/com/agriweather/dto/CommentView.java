package com.agriweather.dto;

public record CommentView(
        Long id,
        String content,
        String author,
        Long authorId,
        String createdAt
) {
}
