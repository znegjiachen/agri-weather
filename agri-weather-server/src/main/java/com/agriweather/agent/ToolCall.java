package com.agriweather.agent;

/** 模型发出的一次工具调用请求 */
public record ToolCall(String id, String name, String arguments) {
}
