package com.agriweather.ai;

/**
 * 农事领域的调用上下文。
 *
 * 框架侧的 AgentContext 对它一无所知，只是原样透传给工具；
 * 工具再用 {@code context.payload(AgriContext.class)} 取回。
 *
 * farmlandId 不为空时表示这是一次「地块专属助农手」的对话，
 * 工具只允许访问这一块地，防止跨地块串答。
 */
public record AgriContext(Long userId, Long agentId, Long farmlandId) {

    /** 兼容旧调用：全局对话没有智能体和地块范围 */
    public AgriContext(Long userId) {
        this(userId, null, null);
    }
}