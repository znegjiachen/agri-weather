package com.agriweather.controller;

import com.agriweather.dto.*;
import com.agriweather.service.CommunityService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * 农友社区。
 *
 * 鉴权沿用项目既有方式：JWT Filter 只把 userId 写进 request attribute，
 * 不建立 SecurityContext，因此这里在方法内显式校验，而不是依赖 Spring Security 的注解。
 */
@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService communityService;

    /** 游标分页列表；未登录也可浏览（liked 恒为 false）。列表只下发摘要，不带完整富文本 */
    @GetMapping("/posts")
    public List<PostSummary> list(@RequestParam(required = false) Long cursor,
                                  @RequestParam(defaultValue = "10") int size,
                                  HttpServletRequest request) {
        return communityService.list(cursor, size, currentUserId(request));
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public PostView create(@Valid @RequestBody CreatePostRequest body, HttpServletRequest request) {
        return communityService.create(requireUserId(request), body);
    }

    @GetMapping("/posts/{id}")
    public PostDetail detail(@PathVariable Long id, HttpServletRequest request) {
        return communityService.detail(id, currentUserId(request));
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentView comment(@PathVariable Long id,
                               @Valid @RequestBody CreateCommentRequest body,
                               HttpServletRequest request) {
        return communityService.addComment(id, requireUserId(request), body.content());
    }

    @PostMapping("/posts/{id}/like")
    public PostView like(@PathVariable Long id, HttpServletRequest request) {
        return communityService.like(id, requireUserId(request), true);
    }

    @DeleteMapping("/posts/{id}/like")
    public PostView unlike(@PathVariable Long id, HttpServletRequest request) {
        return communityService.like(id, requireUserId(request), false);
    }

    /** 软删除，仅作者本人 */
    @DeleteMapping("/posts/{id}")
    public void delete(@PathVariable Long id, HttpServletRequest request) {
        communityService.delete(id, requireUserId(request));
    }

    private Long currentUserId(HttpServletRequest request) {
        return (Long) request.getAttribute("userId");
    }

    private Long requireUserId(HttpServletRequest request) {
        Long userId = currentUserId(request);
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        return userId;
    }
}
