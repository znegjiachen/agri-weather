package com.agriweather.agent;

/**
 * 智能体运行过程观察者。
 *
 * 同步接口可以只关心最终结果；SSE 接口用它把每一轮思考、每次工具调用
 * 实时推给前端。所有回调默认空实现，避免调用方关心全部事件。
 */
public interface AgentObserver {

    AgentObserver NOOP = new AgentObserver() {
    };

    /** 第 round 轮开始，即将调用模型 */
    default void onRoundStarted(int round) {
    }

    /** 模型这一轮的思考内容（reasoner 才有；流式模式下为完整内容） */
    default void onThought(int round, String content) {
    }

    /** token 级思考增量；只有 wantsTokenStream() 为 true 时才会收到 */
    default void onReasoningDelta(int round, String delta) {
    }

    /** token 级回答增量 */
    default void onContentDelta(int round, String delta) {
    }

    /** 是否要求模型使用流式协议（SSE 接口返回 true） */
    default boolean wantsTokenStream() {
        return false;
    }

    /** 开始执行一次工具调用 */
    default void onToolStarted(int round, ToolCall call) {
    }

    /** 工具执行完成（成功或失败都已转成可读摘要） */
    default void onToolFinished(int round, ToolCall call, String resultSummary, long elapsedMs) {
    }

    /** 客户端断开或超时后返回 true，智能体循环应尽快停止 */
    default boolean isCancelled() {
        return false;
    }
}