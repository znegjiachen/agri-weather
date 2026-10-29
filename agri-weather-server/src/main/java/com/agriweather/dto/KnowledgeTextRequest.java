package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class KnowledgeTextRequest {

    @Size(max = 200, message = "文档标题不能超过 200 字")
    private String title;

    @NotBlank(message = "知识内容不能为空")
    @Size(max = 200000, message = "单篇知识不能超过 20 万字符")
    private String content;
}