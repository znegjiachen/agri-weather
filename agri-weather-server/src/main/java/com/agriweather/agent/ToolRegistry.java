package com.agriweather.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工具注册表：把 {@link Tool} 实现汇总起来，对外提供「描述给模型」和「执行」两个能力。
 *
 * 两件横切的事在这里集中处理，工具实现类不需要各自重复：
 *   1. 包装成 OpenAI 协议的工具描述
 *   2. 执行异常转成 JSON 错误对象回喂模型（而不是抛出中断整个对话）——
 *      模型能看到「这个工具失败了、原因是 X」，从而自行换个思路。
 */
@Slf4j
public class ToolRegistry {

    private final Map<String, Tool> byName = new LinkedHashMap<>();
    private final ObjectMapper mapper;

    public ToolRegistry(List<Tool> tools, ObjectMapper mapper) {
        this.mapper = mapper;
        for (Tool t : tools) {
            Tool previous = byName.put(t.name(), t);
            if (previous != null) {
                throw new IllegalStateException("工具名重复：" + t.name());
            }
        }
    }

    /** 返回 OpenAI 协议格式的工具描述列表 */
    public List<Map<String, Object>> toolSchemas() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Tool t : byName.values()) out.add(schema(t));
        return out;
    }

    /**
     * 执行一次工具调用，返回 JSON 字符串。
     *
     * 任何异常都转成 {@code {"error": "..."}} 回给模型，绝不抛出。
     */
    public String execute(String name, String argumentsJson, AgentContext<?> context) {
        try {
            Tool tool = byName.get(name);
            if (tool == null) {
                return mapper.writeValueAsString(Map.of("error", "未知工具：" + name));
            }
            Map<String, Object> args = ToolArgs.parse(argumentsJson, mapper);
            return mapper.writeValueAsString(tool.execute(context, args));
        } catch (Exception e) {
            log.warn("工具 {} 执行失败: {}", name, e.getMessage());
            try {
                return mapper.writeValueAsString(Map.of("error", String.valueOf(e.getMessage())));
            } catch (Exception ignored) {
                return "{\"error\":\"工具执行失败\"}";
            }
        }
    }

    /** 把工具自述包装成 OpenAI 的 {type:function, function:{...}} 结构 */
    private Map<String, Object> schema(Tool tool) {
        Map<String, Object> properties = tool.parameters();

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("type", "object");
        params.put("properties", properties);
        params.put("required", new ArrayList<>(properties.keySet()));

        Map<String, Object> function = new LinkedHashMap<>();
        function.put("name", tool.name());
        function.put("description", tool.description());
        function.put("parameters", params);

        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("type", "function");
        wrapper.put("function", function);
        return wrapper;
    }
}
