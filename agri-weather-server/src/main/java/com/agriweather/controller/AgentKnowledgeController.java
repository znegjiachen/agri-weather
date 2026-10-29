package com.agriweather.controller;

import com.agriweather.dto.KnowledgeDocDetail;
import com.agriweather.dto.KnowledgeDocView;
import com.agriweather.dto.KnowledgeSearchHit;
import com.agriweather.dto.KnowledgeSearchRequest;
import com.agriweather.dto.KnowledgeTextRequest;
import com.agriweather.service.AgentKnowledgeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

/**
 * 智能体知识库：粘贴文本 / TXT·Markdown 上传 / 删除 / 检索测试。
 */
@RestController
@RequestMapping("/api/agents/{agentId}/knowledge")
@RequiredArgsConstructor
public class AgentKnowledgeController {

    private final AgentKnowledgeService knowledgeService;

    @GetMapping
    public List<KnowledgeDocView> list(@PathVariable Long agentId, HttpServletRequest request) {
        return knowledgeService.listDocs(agentId, userId(request));
    }

    @PostMapping("/text")
    public KnowledgeDocView addText(@PathVariable Long agentId,
                                    @Valid @RequestBody KnowledgeTextRequest body,
                                    HttpServletRequest request) {
        return knowledgeService.addText(agentId, userId(request), body.getTitle(), body.getContent());
    }

    @PostMapping(value = "/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public KnowledgeDocView addFile(@PathVariable Long agentId,
                                    @RequestPart("file") MultipartFile file,
                                    @RequestParam(value = "title", required = false) String title,
                                    HttpServletRequest request) throws IOException {
        return knowledgeService.addFile(agentId, userId(request), file, title);
    }

    @GetMapping("/{docId}")
    public KnowledgeDocDetail detail(@PathVariable Long agentId,
                                     @PathVariable Long docId,
                                     HttpServletRequest request) {
        return knowledgeService.getDoc(agentId, docId, userId(request));
    }

    @DeleteMapping("/{docId}")
    public void delete(@PathVariable Long agentId,
                       @PathVariable Long docId,
                       HttpServletRequest request) {
        knowledgeService.deleteDoc(agentId, docId, userId(request));
    }

    @PostMapping("/search")
    public List<KnowledgeSearchHit> search(@PathVariable Long agentId,
                                           @Valid @RequestBody KnowledgeSearchRequest body,
                                           HttpServletRequest request) {
        return knowledgeService.search(agentId, userId(request), body.getQuery());
    }

    private Long userId(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        return userId;
    }
}