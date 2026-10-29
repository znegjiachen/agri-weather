package com.agriweather.controller;

import com.agriweather.dto.AgentDetail;
import com.agriweather.dto.AgentSummary;
import com.agriweather.dto.AgentUpdateRequest;
import com.agriweather.service.AgentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * 智能体控制台：每个地块一个专属助农手。
 */
@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
public class AgentStudioController {

    private final AgentService agentService;

    @GetMapping
    public List<AgentSummary> list(HttpServletRequest request) {
        return agentService.listSummaries(userId(request));
    }

    @GetMapping("/{id}")
    public AgentDetail detail(@PathVariable Long id, HttpServletRequest request) {
        return agentService.detail(id, userId(request));
    }

    @PutMapping("/{id}")
    public AgentDetail update(@PathVariable Long id,
                              @Valid @RequestBody AgentUpdateRequest body,
                              HttpServletRequest request) {
        return agentService.update(id, userId(request), body);
    }

    @PostMapping("/{id}/reset")
    public AgentDetail reset(@PathVariable Long id, HttpServletRequest request) {
        return agentService.reset(id, userId(request));
    }

    @PostMapping("/sync")
    public List<AgentSummary> sync(HttpServletRequest request) {
        return agentService.listSummaries(userId(request));
    }

    private Long userId(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        return userId;
    }
}