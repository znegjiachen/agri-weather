package com.agriweather.agent;

import java.util.List;
import java.util.Map;

/**
 * LLM 传输层接口。
 *
 * messages 采用 OpenAI wire 形状（List&lt;Map&gt;），这是刻意的选择：
 * DeepSeek / OpenAI / 通义等主流 provider 都兼容这个形状，而抽象成中立的
 * 消息模型反而会把 provider 的私有字段（tool_calls、reasoning_content 等）
 * 固化成框架契约 —— 那是假抽象。接非兼容 provider 时在 adapter 内做转换。
 */
public interface ChatModel {

    /**
     * 发起一次对话补全。
     *
     * @param messages 对话历史，含 system / user / assistant / tool 角色
     * @param tools    可用工具定义；传 null 或空表示禁止调用工具
     */
    ChatCompletion chat(List<Map<String, Object>> messages, List<Map<String, Object>> tools);
}
