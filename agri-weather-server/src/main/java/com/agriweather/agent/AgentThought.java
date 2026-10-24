package com.agriweather.agent;

/**
 * 模型一轮思考内容（reasoner 的 reasoning_content）。
 *
 * @param round   第几轮工具循环
 * @param content 思考原文
 */
public record AgentThought(int round, String content) {
}