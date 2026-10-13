package com.agriweather.agent;

/**
 * 单次调用的不透明上下文。
 *
 * 框架不知道里面装的是什么，也不定义任何 key —— 只负责原样透传给工具。
 * 应用侧用自己的类型装载需要的数据（如登录用户ID），工具再取回去。
 */
public final class AgentContext<C> {

    private final C payload;

    private AgentContext(C payload) {
        this.payload = payload;
    }

    public static <C> AgentContext<C> of(C payload) {
        return new AgentContext<>(payload);
    }

    public C payload() {
        return payload;
    }

    /** 在工具侧做一次类型断言取回应用自己的载荷 */
    public <T> T payload(Class<T> type) {
        return type.cast(payload);
    }
}
