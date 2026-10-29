package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class KnowledgeSearchRequest {

    @NotBlank(message = "请输入检索关键词")
    @Size(max = 200, message = "检索词不能超过 200 字")
    private String query;
}