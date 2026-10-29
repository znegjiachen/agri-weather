package com.agriweather.service;

import com.agriweather.ai.AgriAgentPrompts;
import com.agriweather.entity.FarmlandAgent;
import org.springframework.stereotype.Service;

/** 通用农事提示词 + 当前智能体的专属人设 */
@Service
public class AgentPromptBuilder {

    private static final int MAX_PERSONA_CHARS = 2000;

    public String build(FarmlandAgent agent) {
        if (agent == null || agent.getPersona() == null || agent.getPersona().isBlank()) {
            return AgriAgentPrompts.SYSTEM;
        }
        String persona = agent.getPersona().trim();
        if (persona.length() > MAX_PERSONA_CHARS) {
            persona = persona.substring(0, MAX_PERSONA_CHARS) + "…";
        }
        return AgriAgentPrompts.SYSTEM
                + "\n\n## 本智能体的专属设定\n"
                + persona
                + "\n\n以上专属设定与通用规则冲突时，以本智能体的地块范围和安全要求为准。";
    }
}