package com.agriweather.agent;

import java.util.List;

/**
 * 一次智能体对话的结果。
 *
 * @param reply     模型的最终回答
 * @param trace     工具调用轨迹，按发生顺序
 * @param rounds    实际消耗的轮数
 * @param truncated 是否因轮数耗尽被迫收敛（回答可能不完整）
 */
public record AgentResult(String reply,
                          List<ToolCallTrace> trace,
                          int rounds,
                          boolean truncated) {
}
