package com.agriweather.ai;

import com.agriweather.dto.AgentChatResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 农事智能体
 *
 * 实现「模型自主调用工具」的循环：
 *   用户提问 → 模型决定调哪个工具 → 后端执行工具拿真实数据 → 结果回喂模型
 *   → 模型可能再调工具 → …… → 直到模型给出最终回答
 *
 * 与「把数据拼进 prompt」的方案相比，模型看到的是实时真实数据，
 * 而不是我们预先猜它需要什么。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgriAgentService {

    private final DeepSeekClient client;
    private final AgriToolRegistry tools;
    private final DeepSeekProperties props;

    /** 已用轮数达到上限时为 false，用于告知调用方回答可能不完整 */
    public record AgentResult(String reply, List<AgentChatResponse.ToolCallTrace> trace,
                              int rounds, boolean truncated) {}

    private static final String SYSTEM_PROMPT = """
            你是「智慧农事气象服务平台」的农事顾问助手，服务于中国农户。

            ## 你的工作方式
            你拥有若干工具可以查询真实数据。**必须先用工具获取数据，再下结论**——
            绝不允许凭空编造天气数据、作物阶段或地块信息。

            - 用户没指明是哪块地时，先调用 list_farmlands 看看有哪些地块；
              若只有一块地，直接用它；若有多块，简要列出并询问用户指哪一块。
            - 任何涉及天气的问题，先调用 get_weather 拿真实预报。
            - 涉及「什么时候该做什么农活」时，调用 get_operation_advice，
              这是平台内置的权威农事规则，应以它的结论为准。
            - 涉及灾害风险时，调用 check_alerts。
            - 需要作物生长参数时，调用 get_crop_stage 或 search_crop。

            ## 回答要求
            - 用中文回答，语气专业但平实，像一位经验丰富的农技员在和农户说话。
            - 给出具体、可执行的建议，说明理由。例如不要只说「不宜打药」，
              要说「明天风速 12km/h，药液会飘移，建议改到周四上午」。
            - 涉及数据时引用具体数值，不要含糊。
            - 如果工具返回了错误或数据缺失，如实说明，不要编造替代数据。
            - 回答简洁，避免冗长铺陈；农户需要的是能直接照做的结论。
            """;

    /**
     * 执行一次智能体对话
     *
     * @param userMessage 用户本轮提问
     * @param history     历史对话，元素为 {role, content}，可为空
     * @param userId      当前登录用户ID，用于地块权限校验
     */
    public AgentResult run(String userMessage, List<Map<String, String>> history, Long userId) {
        if (!props.isConfigured()) {
            throw new IllegalStateException(
                    "智能体未配置 DeepSeek API Key。请设置环境变量 DEEPSEEK_API_KEY 后重启服务。");
        }

        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(msg("system", SYSTEM_PROMPT));

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

        List<AgentChatResponse.ToolCallTrace> trace = new ArrayList<>();
        List<Map<String, Object>> schemas = tools.toolSchemas();

        for (int round = 1; round <= props.getMaxIterations(); round++) {
            DeepSeekClient.Completion completion = client.chat(messages, schemas);

            // 模型不再调用工具 —— 说明它已经准备好回答
            if (!completion.hasToolCalls()) {
                return new AgentResult(
                        completion.content() != null ? completion.content() : "(模型未返回内容)",
                        trace, round, false);
            }

            // 把模型这轮的「工具调用请求」原样加回历史
            messages.add(completion.assistantMessage());

            // 逐个执行工具，结果作为 tool 消息回喂
            for (DeepSeekClient.ToolCall call : completion.toolCalls()) {
                long start = System.currentTimeMillis();
                String result = tools.execute(call.name(), call.arguments(), userId);
                trace.add(new AgentChatResponse.ToolCallTrace(
                        call.name(),
                        call.arguments(),
                        summarize(result),
                        System.currentTimeMillis() - start));
                messages.add(toolMsg(call.id(), result));
            }
        }

        // 轮数用尽仍未收敛：再问一次，但这次禁用工具，逼模型基于已有信息作答
        log.warn("智能体达到最大工具调用轮数 {}，强制生成最终回答", props.getMaxIterations());
        messages.add(msg("user", "请基于以上已获取的信息，直接给出最终回答，不要再调用工具。"));
        DeepSeekClient.Completion forced = client.chat(messages, null);

        return new AgentResult(
                forced.content() != null ? forced.content() : "(模型未能生成回答)",
                trace, props.getMaxIterations(), true);
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
        return result.length() <= 300 ? result : result.substring(0, 300) + "…";
    }
}
