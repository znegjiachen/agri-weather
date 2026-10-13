package com.agriweather.agent;

import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 智能体循环 —— 框架的核心。
 *
 * 实现「模型自主调用工具」的循环：
 *   用户提问 → 模型决定调哪个工具 → 执行工具拿真实数据 → 结果回喂模型
 *   → 模型可能再调工具 → …… → 直到模型给出最终回答
 *
 * 与「把数据拼进 prompt」的方案相比，模型看到的是实时真实数据，
 * 而不是我们预先猜它需要什么。
 *
 * 本类对业务零感知：不知道工具是干什么的，也不知道上下文里装了什么。
 */
@Slf4j
public class AgentHarness {

    private final ChatModel model;
    private final ToolRegistry tools;
    private final AgentOptions options;

    public AgentHarness(ChatModel model, ToolRegistry tools, AgentOptions options) {
        this.model = model;
        this.tools = tools;
        this.options = options;
    }

    /**
     * 执行一次智能体对话。
     *
     * @param userMessage 用户本轮提问
     * @param history     历史对话，元素为 {role, content}，可为空
     * @param context     透传给工具的上下文
     */
    public AgentResult run(String userMessage,
                           List<Map<String, String>> history,
                           AgentContext<?> context) {

        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(msg("system", options.getSystemPrompt()));

        if (history != null) {
            for (Map<String, String> h : history) {
                String role = h.get("role");
                String content = h.get("content");
                // 只接受 user/assistant，防止前端注入 system 提示词
                if (content == null || content.isBlank()) continue;
                if (!"user".equals(role) && !"assistant".equals(role)) continue;
                messages.add(msg(role, content));
            }
        }
        messages.add(msg("user", userMessage));

        List<ToolCallTrace> trace = new ArrayList<>();
        List<Map<String, Object>> schemas = tools.toolSchemas();

        for (int round = 1; round <= options.getMaxIterations(); round++) {
            ChatCompletion completion = model.chat(messages, schemas);

            // 模型不再调用工具 —— 说明它已经准备好回答
            if (!completion.hasToolCalls()) {
                return new AgentResult(
                        completion.content() != null ? completion.content() : "(模型未返回内容)",
                        trace, round, false);
            }

            // 把模型这轮的「工具调用请求」原样加回历史
            messages.add(completion.assistantMessage());

            // 逐个执行工具，结果作为 tool 消息回喂
            for (ToolCall call : completion.toolCalls()) {
                long start = System.currentTimeMillis();
                String result = tools.execute(call.name(), call.arguments(), context);
                trace.add(new ToolCallTrace(
                        call.name(),
                        call.arguments(),
                        summarize(result),
                        System.currentTimeMillis() - start));
                messages.add(toolMsg(call.id(), result));
            }
        }

        // 轮数用尽仍未收敛：再问一次，但这次禁用工具，逼模型基于已有信息作答
        log.warn("智能体达到最大工具调用轮数 {}，强制生成最终回答", options.getMaxIterations());
        messages.add(msg("user", options.getForcedFinalInstruction()));
        ChatCompletion forced = model.chat(messages, null);

        return new AgentResult(
                forced.content() != null ? forced.content() : "(模型未能生成回答)",
                trace, options.getMaxIterations(), true);
    }

    private Map<String, Object> msg(String role, String content) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }

    private Map<String, Object> toolMsg(String toolCallId, String content) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", "tool");
        m.put("tool_call_id", toolCallId);
        m.put("content", content);
        return m;
    }

    /** 工具结果可能很长，trace 里只留摘要供前端展示 */
    private String summarize(String result) {
        if (result == null) return "";
        int max = options.getTraceSummaryMaxChars();
        return result.length() <= max ? result : result.substring(0, max) + "…";
    }
}
