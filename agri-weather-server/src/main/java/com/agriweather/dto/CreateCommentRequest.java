package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCommentRequest(
        @NotBlank(message = "评论不能为空")
        @Size(max = 1000, message = "评论不超过 1000 字") String content
) {
}
