package com.agriweather.agent;

import java.util.Map;

/**
 * 工具契约。
 *
 * 框架对工具的业务含义零感知 —— 只知道它叫什么、怎么跟模型描述、要哪些参数。
 * 实现类负责真正干活，返回任意对象即可，序列化由 {@link ToolRegistry} 统一处理。
 */
public interface Tool {

    /** 工具名，模型用它来调用。同一注册表内必须唯一 */
    String name();

    /** 给模型看的说明：这个工具能做什么、什么时候该用 */
    String description();

    /** 属性名 → JSON schema 片段。框架视所有属性为必填 */
    Map<String, Object> parameters();

    /**
     * 执行工具。
     *
     * 实现可以抛出任何异常 —— 注册表会统一捕获并转成模型能看懂的错误信息回喂，
     * 而不是中断整个对话。所以这里声明 throws Exception 是刻意的。
     *
     * @param context   单次调用上下文，由调用方提供
     * @param arguments 模型传来的参数（已解析为 Map）
     * @return 任意对象，由注册表序列化成 JSON 回喂模型
     */
    Object execute(AgentContext<?> context, Map<String, Object> arguments) throws Exception;
}
