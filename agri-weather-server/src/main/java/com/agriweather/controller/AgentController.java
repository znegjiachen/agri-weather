package com.agriweather.controller;

import com.agriweather.agent.AgentCancelledException;
import com.agriweather.agent.AgentContext;
import com.agriweather.agent.AgentHarness;
import com.agriweather.agent.AgentObserver;
import com.agriweather.agent.AgentResult;
import com.agriweather.agent.ToolCall;
import com.agriweather.agent.ToolRegistry;
import com.agriweather.ai.AgriContext;
import com.agriweather.ai.DeepSeekClient;
import com.agriweather.ai.DeepSeekProperties;
import com.agriweather.ai.VisionClient;
import com.agriweather.ai.VisionProperties;
import com.agriweather.dto.AgentChatRequest;
import com.agriweather.dto.AgentChatResponse;
import com.agriweather.dto.AgentVisionResponse;
import com.agriweather.dto.KnowledgeRef;
import com.agriweather.entity.Farmland;
import com.agriweather.entity.FarmlandAgent;
import com.agriweather.service.AgentChatHistoryService;
import com.agriweather.service.AgentPromptBuilder;
import com.agriweather.service.AgentService;
import com.agriweather.service.BuiltInKnowledgeService;
import com.agriweather.service.CommunityImageProcessor;
import com.agriweather.service.EmbeddingService;
import com.agriweather.service.KnowledgeRetrievalService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;

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
    private final VisionClient visionClient;
    private final VisionProperties visionProps;
    private final CommunityImageProcessor imageProcessor;
    private final ObjectMapper objectMapper;
    private final ExecutorService agentStreamExecutor;
    private final AgentService agentService;
    private final AgentPromptBuilder agentPromptBuilder;
    private final BuiltInKnowledgeService builtInKnowledgeService;
    private final KnowledgeRetrievalService knowledgeRetrievalService;
    private final AgentChatHistoryService historyService;
    private final EmbeddingService embeddingService;

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

        ChatPreparation prep = prepare(body, userId);

        try {
            AgentResult result = agentHarness.run(
                    prep.message(),
                    body.getHistory(),
                    AgentContext.of(prep.context()),
                    AgentObserver.NOOP,
                    prep.systemPrompt(), prep.enabledTools());

            saveHistory(prep, userId, body, result);

            return new AgentChatResponse(
                    result.reply(), toDto(result.trace()), toThoughts(result.thoughts()),
                    result.rounds(), result.truncated(), props.getModel(), prep.knowledgeUsed());
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
     * 流式对话：每轮思考、工具开始/结束、最终回答通过 SSE 实时推送。
     * POST /api/agent/chat/stream
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@Valid @RequestBody AgentChatRequest body, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }

        ChatPreparation prep = prepare(body, userId);
        String message = prep.message();
        SseEmitter emitter = new SseEmitter(180_000L);
        AtomicBoolean cancelled = new AtomicBoolean(false);

        emitter.onCompletion(() -> cancelled.set(true));
        emitter.onTimeout(() -> {
            cancelled.set(true);
            emitter.complete();
        });
        emitter.onError(e -> cancelled.set(true));

        try {
            agentStreamExecutor.execute(() -> {
                try {
                    AgentResult result = agentHarness.run(
                            message,
                            body.getHistory(),
                            AgentContext.of(prep.context()),
                            new AgentObserver() {
                                @Override
                                public void onRoundStarted(int round) {
                                    if (!sendEvent(emitter, "round", Map.of("round", round))) {
                                        cancelled.set(true);
                                    }
                                }

                                @Override
                                public void onThought(int round, String content) {
                                    Map<String, Object> payload = new LinkedHashMap<>();
                                    payload.put("round", round);
                                    payload.put("content", content);
                                    if (!sendEvent(emitter, "thought", payload)) cancelled.set(true);
                                }

                                @Override
                                public void onToolStarted(int round, ToolCall call) {
                                    Map<String, Object> payload = new LinkedHashMap<>();
                                    payload.put("round", round);
                                    payload.put("tool", call.name());
                                    payload.put("arguments", call.arguments());
                                    if (!sendEvent(emitter, "tool_start", payload)) cancelled.set(true);
                                }

                                @Override
                                public void onToolFinished(int round, ToolCall call,
                                                           String resultSummary, long elapsedMs) {
                                    Map<String, Object> payload = new LinkedHashMap<>();
                                    payload.put("round", round);
                                    payload.put("tool", call.name());
                                    payload.put("arguments", call.arguments());
                                    payload.put("resultSummary", resultSummary);
                                    payload.put("elapsedMs", elapsedMs);
                                    if (!sendEvent(emitter, "tool_end", payload)) cancelled.set(true);
                                }

                                @Override
                                public void onReasoningDelta(int round, String delta) {
                                    Map<String, Object> payload = new LinkedHashMap<>();
                                    payload.put("round", round);
                                    payload.put("delta", delta);
                                    if (!sendEvent(emitter, "reasoning_delta", payload)) {
                                        cancelled.set(true);
                                    }
                                }

                                @Override
                                public void onContentDelta(int round, String delta) {
                                    Map<String, Object> payload = new LinkedHashMap<>();
                                    payload.put("round", round);
                                    payload.put("delta", delta);
                                    if (!sendEvent(emitter, "content_delta", payload)) {
                                        cancelled.set(true);
                                    }
                                }

                                @Override
                                public boolean wantsTokenStream() {
                                    return true;
                                }

                                @Override
                                public boolean isCancelled() {
                                    return cancelled.get();
                                }
                            },
                            prep.systemPrompt(), prep.enabledTools());

                    saveHistory(prep, userId, body, result);

                    Map<String, Object> done = new LinkedHashMap<>();
                    done.put("reply", result.reply());
                    done.put("toolCalls", toDto(result.trace()));
                    done.put("thoughts", toThoughts(result.thoughts()));
                    done.put("rounds", result.rounds());
                    done.put("truncated", result.truncated());
                    done.put("model", props.getModel());
                    done.put("knowledgeUsed", prep.knowledgeUsed());
                    sendEvent(emitter, "done", done);
                    emitter.complete();
                } catch (AgentCancelledException e) {
                    emitter.complete();
                } catch (DeepSeekClient.DeepSeekException | IllegalStateException e) {
                    sendEvent(emitter, "error", Map.of("message", String.valueOf(e.getMessage())));
                    emitter.complete();
                } catch (Exception e) {
                    log.error("智能体流式对话异常", e);
                    sendEvent(emitter, "error",
                            Map.of("message", "智能体处理失败：" + e.getClass().getSimpleName()));
                    emitter.complete();
                }
            });
        } catch (RejectedExecutionException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "当前咨询人数较多，请稍后再试");
        }

        return emitter;
    }

    /** SSE 事件统一序列化成 JSON 字符串，前端按 event 名分发 */
    private boolean sendEvent(SseEmitter emitter, String name, Object payload) {
        try {
            emitter.send(SseEmitter.event()
                    .name(name)
                    .data(objectMapper.writeValueAsString(payload)));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 解析本次请求的智能体、拼接人设和知识库，构造发给模型的消息。
     *
     * 这里是 Chat 与 SSE 共用的唯一入口；知识库异常只降级不阻断对话。
     */
    private ChatPreparation prepare(AgentChatRequest body, Long userId) {
        FarmlandAgent agent = agentService.resolveForChat(userId, body.getAgentId(), body.getFarmlandId());

        Farmland field = null;
        if (agent != null) {
            try {
                field = agentService.requireOwnedFarmland(agent.getFarmlandId(), userId);
            } catch (Exception e) {
                log.warn("加载智能体地块失败 agentId={}: {}", agent.getId(), e.getMessage());
            }
        }
        String systemPrompt = agentPromptBuilder.build(agent, field);

        String knowledgeBlock = "";
        List<KnowledgeRef> knowledgeUsed = List.of();
        if (agent != null && field != null) {
            try {
                String builtin = builtInKnowledgeService.build(field);
                KnowledgeRetrievalService.KnowledgePackage kb =
                        knowledgeRetrievalService.buildBlock(agent.getId(), body.getMessage());

                StringBuilder block = new StringBuilder();
                if (kb.block() != null && !kb.block().isBlank()) {
                    block.append(kb.block());
                }
                if (builtin != null && !builtin.isBlank()) {
                    if (block.length() > 0) block.append("\n\n");
                    block.append("【内置作物档案（由地块作物设置实时生成）】\n").append(builtin);
                }
                knowledgeBlock = block.toString();
                knowledgeUsed = kb.refs();
            } catch (Exception e) {
                log.warn("加载智能体知识库失败 agentId={}: {}", agent.getId(), e.getMessage());
            }
        }

        String message = buildUserMessage(body, knowledgeBlock);
        AgriContext context = new AgriContext(
                userId,
                agent != null ? agent.getId() : null,
                agent != null ? agent.getFarmlandId() : body.getFarmlandId());
        Set<String> enabledTools = agent != null
                ? agentService.enabledToolSet(agent)
                : toolRegistry.allToolNames();
        return new ChatPreparation(message, context, systemPrompt, knowledgeUsed, enabledTools);
    }

    /** 当前时间 + 用户问题 + 可选图片识别结果 + 本智能体知识库 */
    private String buildUserMessage(AgentChatRequest body, String knowledgeBlock) {
        String message = "【当前时间】"
                + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                + "\n\n" + body.getMessage();

        if (body.getVisionContext() != null && !body.getVisionContext().isBlank()) {
            message = message + "\n\n【图片识别结果（视觉模型提供，供参考）】\n"
                    + body.getVisionContext().trim();
        }
        if (knowledgeBlock != null && !knowledgeBlock.isBlank()) {
            message = message + "\n\n" + knowledgeBlock.trim();
        }
        return message;
    }

    /** 历史写入失败不能影响本次回答 */
    private void saveHistory(ChatPreparation prep, Long userId,
                             AgentChatRequest body, AgentResult result) {
        try {
            historyService.saveTurn(prep.context().agentId(), userId, body.getMessage(),
                    body.getVisionJson(), result, prep.knowledgeUsed());
        } catch (Exception e) {
            log.warn("保存智能体对话历史失败: {}", e.getMessage());
        }
    }

    private record ChatPreparation(
            String message,
            AgriContext context,
            String systemPrompt,
            List<KnowledgeRef> knowledgeUsed,
            Set<String> enabledTools
    ) {
    }

    /**
     * 作物照片识别（多模态）
     * POST /api/agent/vision
     * multipart: files（1-4 张 JPG/PNG），note（可选，用户文字补充）
     */
    @PostMapping(value = "/vision", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AgentVisionResponse vision(@RequestParam("files") List<MultipartFile> files,
                                      @RequestParam(required = false) String note,
                                      HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        if (!visionProps.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "未配置视觉模型 API Key，请设置 VISION_API_KEY 或 DEEPSEEK_API_KEY");
        }
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("请上传至少一张作物照片");
        }
        if (files.size() > visionProps.getMaxImages()) {
            throw new IllegalArgumentException("一次最多识别 " + visionProps.getMaxImages() + " 张照片");
        }

        List<VisionClient.ImageInput> inputs = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            if (file.getSize() > visionProps.getMaxImageBytes()) {
                throw new IllegalArgumentException("单张图片不能超过 5MB");
            }
            try {
                CommunityImageProcessor.ProcessedImage processed = imageProcessor.process(file.getBytes());
                inputs.add(new VisionClient.ImageInput(processed.data(), processed.mimeType()));
            } catch (IOException e) {
                throw new IllegalArgumentException("图片读取失败，请重试");
            }
        }
        if (inputs.isEmpty()) {
            throw new IllegalArgumentException("图片内容为空，请重新选择");
        }

        String cleanNote = note == null ? "" : note.trim();
        if (cleanNote.length() > 300) {
            cleanNote = cleanNote.substring(0, 300);
        }

        try {
            return visionClient.analyze(inputs, cleanNote);
        } catch (VisionClient.VisionException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
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
                "maxIterations", props.getMaxIterations(),
                "visionConfigured", visionProps.isConfigured(),
                "visionModel", visionProps.getModel(),
                "embeddingConfigured", embeddingService.isExternalConfigured(),
                "embeddingMode", embeddingService.modeLabel(),
                "embeddingModel", embeddingService.modelName()
        );
    }

    /**
     * 框架的轨迹类型 → 对外 DTO。
     * 刻意做这层映射：对外接口契约不该依赖框架内部类型，否则框架一改就破坏 API。
     */
    private List<AgentChatResponse.ToolCallTrace> toDto(List<com.agriweather.agent.ToolCallTrace> trace) {
        return trace.stream()
                .map(t -> new AgentChatResponse.ToolCallTrace(
                        t.getRound(), t.getTool(), t.getArguments(),
                        t.getResultSummary(), t.getElapsedMs()))
                .toList();
    }

    private List<AgentChatResponse.ThoughtTrace> toThoughts(List<com.agriweather.agent.AgentThought> thoughts) {
        if (thoughts == null) return List.of();
        return thoughts.stream()
                .map(t -> new AgentChatResponse.ThoughtTrace(t.round(), t.content()))
                .toList();
    }
}
