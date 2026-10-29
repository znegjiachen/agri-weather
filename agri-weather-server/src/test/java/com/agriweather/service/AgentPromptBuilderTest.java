package com.agriweather.service;

import com.agriweather.ai.AgriAgentPrompts;
import com.agriweather.entity.FarmlandAgent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AgentPromptBuilderTest {

    private final AgentPromptBuilder builder = new AgentPromptBuilder();

    @Test
    @DisplayName("没有智能体时使用通用提示词")
    void fallbackToBasePrompt() {
        assertEquals(AgriAgentPrompts.SYSTEM, builder.build(null));
    }

    @Test
    @DisplayName("智能体人设拼接到通用规则之后")
    void appendsPersona() {
        FarmlandAgent agent = new FarmlandAgent();
        agent.setPersona("你是「3号田」的专属助农手，只处理玉米问题。");
        String prompt = builder.build(agent);
        assertTrue(prompt.startsWith(AgriAgentPrompts.SYSTEM));
        assertTrue(prompt.contains("3号田"));
        assertTrue(prompt.contains("专属设定"));
    }

    @Test
    @DisplayName("人设过长会截断")
    void truncatesLongPersona() {
        FarmlandAgent agent = new FarmlandAgent();
        agent.setPersona("农".repeat(5000));
        String prompt = builder.build(agent);
        assertTrue(prompt.length() < AgriAgentPrompts.SYSTEM.length() + 2200);
    }
}