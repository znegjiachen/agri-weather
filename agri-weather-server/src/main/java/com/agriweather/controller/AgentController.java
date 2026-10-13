package com.agriweather.controller;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.AgentHarness;
import com.agriweather.agent.AgentResult;
import com.agriweather.agent.ToolRegistry;
import com.agriweather.ai.AgriContext;
import com.agriweather.ai.DeepSeekClient;
import com.agriweather.ai.DeepSeekProperties;
import com.agriweather.dto.AgentChatRequest;
import com.agriweather.dto.AgentChatResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * 农事智能体接口
 */
@Slf4j
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentController {

    private final AgentHarness agentHarness;
    private final ToolRegistry toolRegistry;
    private final DeepSeekProperties props;

    /**
     * 与农事智能体对话
     * POST /api/agent/chat
     * Body: {"message": "明天适合给番茄打药吗", "history": [{"role":"user","content":"..."}]}
     *
     * 需要登录 —— 智能体只能查询当前用户自己的地块。
     */
    @PostMapping("/chat")
    public AgentChatResponse chat(@Valid @RequestBody AgentChatRequest body, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }

        try {
            AgentResult result = agentHarness.run(
                    body.getMessage(),
                    body.getHistory(),
                    AgentContext.of(new AgriContext(userId)));

            return new AgentChatResponse(
                    result.reply(), toDto(result.trace()), result.rounds(),
                    result.truncated(), props.getModel());
        } catch (DeepSeekClient.DeepSeekException e) {
            // 上游模型的问题：密钥、余额、限流、超时
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        } catch (IllegalStateException e) {
            // 未配置 API Key
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        } catch (Exception e) {
            log.error("智能体对话异常", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "智能体处理失败：" + e.getClass().getSimpleName());
        }
    }

    /**
     * 查看智能体当前可调用的工具清单（调试用）
     * GET /api/agent/tools
     */
    @GetMapping("/tools")
    public List<Map<String, Object>> listTools() {
        return toolRegistry.toolSchemas();
    }

    /**
     * 智能体运行状态
     * GET /api/agent/status
     */
    @GetMapping("/status")
    public Map<String, Object> status() {
        return Map.of(
                "configured", props.isConfigured(),
                "model", props.getModel(),
                "baseUrl", props.getBaseUrl(),
                "maxIterations", props.getMaxIterations()
        );
    }

    /**
     * 框架的轨迹类型 → 对外 DTO。
     * 刻意做这层映射：对外接口契约不该依赖框架内部类型，否则框架一改就破坏 API。
     */
    private List<AgentChatResponse.ToolCallTrace> toDto(List<com.agriweather.agent.ToolCallTrace> trace) {
        return trace.stream()
                .map(t -> new AgentChatResponse.ToolCallTrace(
                        t.getTool(), t.getArguments(), t.getResultSummary(), t.getElapsedMs()))
                .toList();
    }
}
