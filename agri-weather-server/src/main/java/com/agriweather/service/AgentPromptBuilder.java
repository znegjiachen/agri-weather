package com.agriweather.service;

import com.agriweather.ai.AgriAgentPrompts;
import com.agriweather.entity.Farmland;
import com.agriweather.entity.FarmlandAgent;
import org.springframework.stereotype.Service;

/** 通用农事提示词 + 当前智能体的专属人设 */
@Service
public class AgentPromptBuilder {

    private static final int MAX_PERSONA_CHARS = 2000;

    public String build(FarmlandAgent agent) {
        return build(agent, null);
    }

    public String build(FarmlandAgent agent, Farmland field) {
        String prompt = AgriAgentPrompts.SYSTEM;
        if (agent != null && agent.getPersona() != null && !agent.getPersona().isBlank()) {
            String persona = agent.getPersona().trim();
            if (persona.length() > MAX_PERSONA_CHARS) {
                persona = persona.substring(0, MAX_PERSONA_CHARS) + "…";
            }
            prompt += "\n\n## 本智能体的专属设定\n" + persona
                    + "\n\n以上专属设定与通用规则冲突时，以本智能体的地块范围和安全要求为准。";
        }
        if (field != null) {
            // 工具调用需要精确的地块 ID；只给地块名，模型很容易把「3号田」误当成 ID=3
            prompt += "\n\n## 当前地块\n你只负责「" + field.getFieldName()
                    + "」，farmlandId=" + field.getId()
                    + "。调用任何需要 farmlandId 的工具时，必须使用这个 ID，不要使用其他数字。";
        }
        return prompt;
    }
}