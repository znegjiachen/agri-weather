package com.agriweather.ai;

/**
 * 农事领域的调用上下文。
 *
 * 框架侧的 AgentContext 对它一无所知，只是原样透传给工具；
 * 工具再用 {@code context.payload(AgriContext.class)} 取回。
 */
public record AgriContext(Long userId) {
}
