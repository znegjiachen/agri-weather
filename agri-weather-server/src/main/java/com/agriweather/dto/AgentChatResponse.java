package com.agriweather.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentChatResponse {

    /** 智能体的最终回答 */
    private String reply;

    /** 本次回答过程中调用了哪些工具 —— 便于前端展示「它查了什么」和排查问题 */
    private List<ToolCallTrace> toolCalls;

    /** 每轮模型的思考内容（reasoner 模型才有） */
    private List<ThoughtTrace> thoughts;

    /** 经过了几轮模型交互 */
    private int rounds;

    /** 是否因达到轮数上限被强制截断（回答可能不完整） */
    private boolean truncated;

    /** 使用的模型 */
    private String model;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ToolCallTrace {
        /** 第几轮工具循环 */
        private int round;
        /** 工具名，如 get_weather */
        private String tool;
        /** 模型传入的参数（JSON 字符串） */
        private String arguments;
        /** 工具返回内容摘要 */
        private String resultSummary;
        /** 耗时毫秒 */
        private long elapsedMs;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ThoughtTrace {
        /** 第几轮 */
        private int round;
        /** 思考原文 */
        private String content;
    }
}
