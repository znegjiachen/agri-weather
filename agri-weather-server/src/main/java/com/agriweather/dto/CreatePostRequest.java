package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 发帖请求。
 *
 * content 的长度限制按 contentFormat 在 Service 里分别校验：
 * TEXT 仍然 ≤2000 字，HTML 是净化后 ≤20000 字符 + 可见文字 ≤2000 字，
 * 因此不能再统一挂 @Size(max=2000)。
 */
public record CreatePostRequest(
        @Size(max = 100, message = "标题不超过 100 字") String title,
        @NotBlank(message = "内容不能为空") String content,
        /** TEXT（默认，旧客户端）/ HTML（富文本编辑器） */
        String contentFormat,
        String category
) {
}