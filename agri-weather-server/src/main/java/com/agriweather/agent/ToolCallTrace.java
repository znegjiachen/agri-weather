package com.agriweather.agent;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 一次工具调用的轨迹，供调用方展示「模型查了什么、拿到了什么」。
 *
 * 刻意用 class 而非 record：调用方沿用 getXxx() 取值。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ToolCallTrace {

    /** 第几轮工具循环，与思考内容对齐 */
    private int round;

    /** 工具名 */
    private String tool;

    /** 模型传入的参数（原始 JSON 字符串） */
    private String arguments;

    /** 工具返回内容的摘要 */
    private String resultSummary;

    /** 执行耗时（毫秒） */
    private long elapsedMs;
}
