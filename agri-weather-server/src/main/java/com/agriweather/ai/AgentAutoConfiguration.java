package com.agriweather.ai;

import com.agriweather.agent.AgentHarness;
import com.agriweather.agent.AgentOptions;
import com.agriweather.agent.ChatModel;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 把框架组件装配成 Spring Bean。
 *
 * 框架类（com.agriweather.agent.*）自身不带任何 Spring 注解 —— 它们要能在纯 Java
 * 环境里直接 new（单元测试就是这么用的）。装配的职责集中在这里。
 */
@Configuration
@EnableConfigurationProperties({DeepSeekProperties.class, VisionProperties.class, EmbeddingProperties.class, AsrProperties.class})
public class AgentAutoConfiguration {

    @Bean
    public ChatModel chatModel(DeepSeekProperties props, ObjectMapper mapper) {
        return new DeepSeekClient(props, mapper);
    }

    /** 植物照片识别：与文本智能体解耦，识别结果再作为上下文喂给文本模型 */
    @Bean
    public VisionClient visionClient(VisionProperties props, ObjectMapper mapper) {
        return new VisionClient(props, mapper);
    }

    /** 所有 Tool 实现由 Spring 自动收集注入 */
    @Bean
    public ToolRegistry toolRegistry(List<Tool> tools, ObjectMapper mapper) {
        return new ToolRegistry(tools, mapper);
    }

    /** 把 DeepSeekProperties 里适用的参数搬进框架的运行参数，并注入农事提示词 */
    @Bean
    public AgentOptions agentOptions(DeepSeekProperties props) {
        AgentOptions options = new AgentOptions();
        options.setMaxIterations(props.getMaxIterations());
        options.setSystemPrompt(AgriAgentPrompts.SYSTEM);
        options.setForcedFinalInstruction(AgriAgentPrompts.FORCED_FINAL);
        return options;
    }

    @Bean
    public AgentHarness agentHarness(ChatModel model, ToolRegistry tools, AgentOptions options) {
        return new AgentHarness(model, tools, options);
    }

    /** SSE 会话跑在独立线程池，避免占满 Tomcat 请求线程 */
    @Bean(name = "agentStreamExecutor", destroyMethod = "shutdown")
    public ExecutorService agentStreamExecutor() {
        return Executors.newFixedThreadPool(4, r -> {
            Thread thread = new Thread(r, "agent-stream");
            thread.setDaemon(true);
            return thread;
        });
    }
}
