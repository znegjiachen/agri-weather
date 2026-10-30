package com.agriweather.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ToolRegistryTest {

    @Test
    @DisplayName("按智能体配置过滤工具 schema")
    void filtersToolSchemas() {
        Tool a = stub("tool_a");
        Tool b = stub("tool_b");
        ToolRegistry registry = new ToolRegistry(List.of(a, b), new ObjectMapper());

        assertEquals(Set.of("tool_a", "tool_b"), registry.allToolNames());
        assertEquals(2, registry.toolSchemas().size());
        assertEquals(1, registry.toolSchemas(Set.of("tool_a")).size());

        @SuppressWarnings("unchecked")
        Map<String, Object> function = (Map<String, Object>) registry.toolSchemas(Set.of("tool_a"))
                .get(0).get("function");
        assertEquals("tool_a", function.get("name"));
    }

    private Tool stub(String name) {
        return new Tool() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String description() {
                return name;
            }

            @Override
            public Map<String, Object> parameters() {
                return Map.of();
            }

            @Override
            public Object execute(AgentContext<?> context, Map<String, Object> args) {
                return "ok";
            }
        };
    }
}