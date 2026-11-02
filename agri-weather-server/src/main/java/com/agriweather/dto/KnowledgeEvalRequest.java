package com.agriweather.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/** RAG 检索评测：给定问题与期望关键词，统计命中率 */
@Data
public class KnowledgeEvalRequest {

    @NotEmpty(message = "请至少提供一条评测用例")
    @Size(max = 50, message = "一次最多评测 50 条")
    @Valid
    private List<Case> cases;

    @Data
    public static class Case {
        @NotBlank(message = "问题不能为空")
        private String question;

        @NotEmpty(message = "请提供期望关键词")
        private List<String> expectedKeywords;
    }
}