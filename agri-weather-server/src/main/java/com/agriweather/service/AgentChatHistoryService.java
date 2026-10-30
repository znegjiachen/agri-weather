package com.agriweather.service;

import com.agriweather.agent.AgentResult;
import com.agriweather.dto.AgentMessageView;
import com.agriweather.dto.KnowledgeRef;
import com.agriweather.entity.AgentChatMessage;
import com.agriweather.repository.AgentChatMessageRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 智能体对话历史的持久化。
 *
 * 每个（用户，智能体）一条连续会话；刷新前端后从最近 50 条恢复。
 * 图片预览本身不落库，只保存文字和结构化识别结果。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentChatHistoryService {

    private final AgentChatMessageRepository repository;
    private final AgentService agentService;
    private final ObjectMapper objectMapper;

    @Transactional
    public void saveTurn(Long agentId, Long userId, String userContent, String visionJson,
                         AgentResult result, List<KnowledgeRef> knowledgeUsed) {
        if (agentId == null || result == null) return;
        agentService.requireOwned(agentId, userId);

        AgentChatMessage user = new AgentChatMessage();
        user.setAgentId(agentId);
        user.setUserId(userId);
        user.setRole("user");
        user.setContent(userContent);
        user.setVision(normalizeJson(visionJson));
        user.setCreatedAt(LocalDateTime.now());
        repository.save(user);

        AgentChatMessage assistant = new AgentChatMessage();
        assistant.setAgentId(agentId);
        assistant.setUserId(userId);
        assistant.setRole("assistant");
        assistant.setContent(result.reply());
        assistant.setToolCalls(toJson(result.trace()));
        assistant.setThoughts(toJson(result.thoughts()));
        assistant.setKnowledgeUsed(toJson(knowledgeUsed));
        assistant.setCreatedAt(LocalDateTime.now());
        repository.save(assistant);
    }

    public List<AgentMessageView> list(Long agentId, Long userId, int limit) {
        agentService.requireOwned(agentId, userId);
        int size = Math.max(1, Math.min(limit <= 0 ? 50 : limit, 100));
        List<AgentChatMessage> messages = repository
                .findByAgentIdAndUserIdOrderByIdDesc(agentId, userId, PageRequest.of(0, size));
        Collections.reverse(messages);

        List<AgentMessageView> result = new ArrayList<>();
        for (AgentChatMessage message : messages) {
            result.add(new AgentMessageView(
                    message.getId(),
                    message.getRole(),
                    message.getContent(),
                    parseObject(message.getVision()),
                    parseList(message.getToolCalls()),
                    parseList(message.getThoughts()),
                    parseList(message.getKnowledgeUsed()),
                    message.getCreatedAt()
            ));
        }
        return result;
    }

    @Transactional
    public void clear(Long agentId, Long userId) {
        agentService.requireOwned(agentId, userId);
        repository.deleteByAgentIdAndUserId(agentId, userId);
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("序列化对话历史失败: {}", e.getMessage());
            return null;
        }
    }

    private String normalizeJson(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private Map<String, Object> parseObject(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private List<Map<String, Object>> parseList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}