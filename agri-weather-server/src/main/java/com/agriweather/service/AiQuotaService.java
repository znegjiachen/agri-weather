package com.agriweather.service;

import com.agriweather.config.AiQuotaProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * 每日 AI 额度：按用户 + 日期计数，Redis 不可用时放行。
 * 和每分钟限流互补：限流防突发，额度防长期滥用。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiQuotaService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    private final AiQuotaProperties properties;
    private final StringRedisTemplate redis;

    public boolean tryConsume(Long userId) {
        if (userId == null) return false;
        if (!properties.isQuotaEnabled() || properties.getDailyChatQuota() <= 0) return true;

        String key = "agri:quota:chat:" + userId + ":" + LocalDate.now().format(DAY);
        try {
            Long used = redis.opsForValue().increment(key);
            if (used != null && used == 1L) {
                redis.expire(key, Duration.ofDays(2));
            }
            return used == null || used <= properties.getDailyChatQuota();
        } catch (Exception e) {
            log.warn("AI 额度检查失败，本次放行: {}", e.getMessage());
            return true;
        }
    }
}