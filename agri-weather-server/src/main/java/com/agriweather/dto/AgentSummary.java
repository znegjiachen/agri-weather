package com.agriweather.dto;

import java.time.LocalDateTime;

/** 智能体控制台列表项：不返回人设全文，避免列表过重 */
public record AgentSummary(
        Long id,
        Long farmlandId,
        String farmlandName,
        Long cropId,
        String cropName,
        String name,
        String avatar,
        boolean personaCustom,
        long docCount,
        long chunkCount,
        LocalDateTime updatedAt
) {
}