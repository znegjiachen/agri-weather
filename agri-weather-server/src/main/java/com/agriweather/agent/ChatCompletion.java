package com.agriweather.agent;

import java.util.List;
import java.util.Map;

/**
 * 一次对话补全的结果。
 *
 * {@code assistantMessage} 是 provider 原样返回的原始 message（含 tool_calls），
 * 必须原封不动回加进对话历史 —— 这是 OpenAI 兼容协议的硬要求。
 */
public record ChatCompletion(String content,
                             List<ToolCall> toolCalls,
                             Map<String, Object> assistantMessage) {

    /** 模型这一轮是否要求调用工具 */
    public boolean hasToolCalls() {
        return toolCalls != null && !toolCalls.isEmpty();
    }
}
