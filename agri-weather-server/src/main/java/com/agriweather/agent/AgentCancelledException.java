package com.agriweather.agent;

/** 客户端已断开，停止继续调用模型和工具 */
public class AgentCancelledException extends RuntimeException {
    public AgentCancelledException() {
        super("智能体请求已取消");
    }
}