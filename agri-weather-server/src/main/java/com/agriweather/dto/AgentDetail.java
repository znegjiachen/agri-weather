package com.agriweather.dto;

import java.time.LocalDateTime;

/** 智能体控制台详情：人设、欢迎语、只读的内置作物知识、知识库规模 */
public record AgentDetail(
        Long id,
        Long farmlandId,
        String farmlandName,
        Long cropId,
        String cropName,
        String name,
        String avatar,
        String persona,
        String welcome,
        boolean personaCustom,
        long docCount,
        long chunkCount,
        String builtinKnowledge,
        LocalDateTime updatedAt
) {
}