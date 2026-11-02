package com.agriweather.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

/**
 * 基于 Redis 的简单每分钟限流。
 *
 * Redis 不可用时放行，优先保证可用性；限流键按用户 ID，未登录时按 IP。
 */
@Slf4j
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redis;
    private final RateLimitProperties properties;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!properties.isEnabled() || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        Rule rule = ruleFor(request);
        if (rule == null) {
            chain.doFilter(request, response);
            return;
        }

        Long userId = (Long) request.getAttribute("userId");
        String identity = userId != null ? "u" + userId : "ip" + clientIp(request);
        String key = "agri:rl:" + rule.name + ":" + identity;

        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redis.expire(key, Duration.ofMinutes(1));
            }
            if (count != null && count > rule.limit) {
                response.setStatus(429);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(
                        "{\"error\":\"TOO_MANY_REQUESTS\",\"message\":\"操作太频繁，请稍后再试\"}");
                return;
            }
        } catch (Exception e) {
            // 限流依赖 Redis，缓存不可用时不能阻断主流程
            log.warn("限流检查失败，本次放行: {}", e.getMessage());
        }

        chain.doFilter(request, response);
    }

    private Rule ruleFor(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return null;
        String path = request.getRequestURI();
        if ("/api/auth/login".equals(path) || "/api/auth/register".equals(path)) {
            return new Rule("auth", properties.getAuthPerMinute());
        }
        if (path.startsWith("/api/agent/chat")) {
            return new Rule("agent", properties.getAgentPerMinute());
        }
        if (path.startsWith("/api/agent/vision")
                || path.startsWith("/api/agent/transcribe")
                || path.startsWith("/api/agent/document")) {
            return new Rule("upload", properties.getUploadPerMinute());
        }
        return null;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private record Rule(String name, int limit) {
    }
}