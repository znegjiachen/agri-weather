package com.agriweather.dto;

import java.util.List;

/** 植物照片识别结果（由视觉模型输出，供前端展示并注入智能体上下文） */
public record AgentVisionResponse(
        String plantName,
        String scientificName,
        String growthStage,
        String healthStatus,
        List<Issue> issues,
        String overallAssessment,
        List<String> careAdvice,
        String model,
        int imageCount
) {
    public record Issue(
            String type,
            String name,
            Double confidence,
            String symptoms,
            String suggestion
    ) {
    }
}