package com.agriweather.agent;

import lombok.Data;

/**
 * 智能体运行参数。
 *
 * 默认值是领域中立的，由应用侧在装配时覆盖成自己的 system prompt 等。
 */
@Data
public class AgentOptions {

    /** 单次对话最多几轮工具调用；用尽后强制模型收敛 */
    private int maxIterations = 6;

    /** 系统提示词，定义智能体的角色和工作方式 */
    private String systemPrompt =
            "You are a helpful assistant. Use the provided tools when needed.";

    /** 轮数耗尽时追加的指令，逼模型基于已有信息作答 */
    private String forcedFinalInstruction =
            "Please give your final answer now using the information already gathered. "
                    + "Do not call any more tools.";

    /** trace 里工具结果摘要的最大长度，超长截断 */
    private int traceSummaryMaxChars = 300;

    /** 最多带多少条历史消息，防止前端无限堆积 */
    private int historyMaxMessages = 20;

    /** 历史消息的总字符上限（保留最近的部分） */
    private int historyMaxChars = 12000;
}
