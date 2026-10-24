package com.agriweather.agent;

import java.util.List;

/**
 * 一次智能体对话的结果。
 *
 * @param reply     模型的最终回答
 * @param trace     工具调用轨迹，按发生顺序
 * @param thoughts  模型每轮的思考内容（reasoner 模型才有）
 * @param rounds    实际消耗的轮数
 * @param truncated 是否因轮数耗尽被迫收敛（回答可能不完整）
 */
public record AgentResult(String reply,
                          List<ToolCallTrace> trace,
                          List<AgentThought> thoughts,
                          int rounds,
                          boolean truncated) {
}
