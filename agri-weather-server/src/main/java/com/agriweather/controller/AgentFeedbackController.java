package com.agriweather.controller;

import com.agriweather.dto.AgentFeedbackRequest;
import com.agriweather.entity.AgentChatMessage;
import com.agriweather.entity.AgentFeedback;
import com.agriweather.repository.AgentChatMessageRepository;
import com.agriweather.repository.AgentFeedbackRepository;
import com.agriweather.service.AgentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/** 助农手回答反馈：点赞/点踩，用于评测和迭代 */
@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
public class AgentFeedbackController {

    private final AgentService agentService;
    private final AgentChatMessageRepository messageRepository;
    private final AgentFeedbackRepository feedbackRepository;

    @PostMapping("/{id}/feedback")
    public Map<String, Object> feedback(@PathVariable Long id,
                                        @Valid @RequestBody AgentFeedbackRequest request,
                                        HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        agentService.requireOwned(id, userId);

        AgentChatMessage latest = messageRepository
                .findFirstByAgentIdAndUserIdAndRoleOrderByIdDesc(id, userId, "assistant")
                .orElse(null);

        AgentFeedback feedback = latest == null ? new AgentFeedback()
                : feedbackRepository.findFirstByMessageIdAndUserId(latest.getId(), userId)
                .orElseGet(AgentFeedback::new);

        feedback.setUserId(userId);
        feedback.setAgentId(id);
        feedback.setMessageId(latest == null ? null : latest.getId());
        feedback.setRating(request.getRating());
        feedback.setComment(request.getComment());
        if (feedback.getCreatedAt() == null) feedback.setCreatedAt(LocalDateTime.now());
        feedbackRepository.save(feedback);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("rating", feedback.getRating());
        result.put("messageId", feedback.getMessageId());
        return result;
    }
}