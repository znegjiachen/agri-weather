package com.agriweather.agent;

import java.util.List;
import java.util.Map;

/**
 * 一次对话补全的结果。
 *
 * {@code assistantMessage} 是 provider 返回的 message（含 tool_calls），
 * 必须回加进对话历史 —— 这是 OpenAI 兼容协议的硬要求。
 * reasoner 的 reasoning_content 属于展示信息，已从 assistantMessage 中剔除，
 * 避免回传给上游。
 */
public record ChatCompletion(String content,
                             String reasoning,
                             List<ToolCall> toolCalls,
                             Map<String, Object> assistantMessage) {

    /** 模型这一轮是否要求调用工具 */
    public boolean hasToolCalls() {
        return toolCalls != null && !toolCalls.isEmpty();
    }
}
