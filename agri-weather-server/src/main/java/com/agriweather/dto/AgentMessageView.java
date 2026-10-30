package com.agriweather.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** 持久化的对话消息，结构对齐前端 AgentContext 里的消息 */
public record AgentMessageView(
        Long id,
        String role,
        String content,
        Map<String, Object> vision,
        List<Map<String, Object>> toolCalls,
        List<Map<String, Object>> thoughts,
        List<Map<String, Object>> knowledgeUsed,
        LocalDateTime createdAt
) {
}