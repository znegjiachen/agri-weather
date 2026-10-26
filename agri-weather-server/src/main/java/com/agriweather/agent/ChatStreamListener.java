package com.agriweather.agent;

/** 模型流式增量回调：reasoning_content 与 content 分开 */
public interface ChatStreamListener {

    default void onReasoningDelta(String delta) {
    }

    default void onContentDelta(String delta) {
    }
}