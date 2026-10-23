package com.agriweather.weather;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * 基于 Redis SETNX 的简单分布式锁，用于保证多实例下同一时刻只有一个实例执行预取。
 *
 * 释放必须用「比较 token 再删」的 Lua 脚本：直接 DEL 可能误删掉
 * 锁过期后别的实例刚刚获取到的那把锁。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisLeaderLock {

    private static final DefaultRedisScript<Long> RELEASE = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] "
                    + "then return redis.call('del', KEYS[1]) else return 0 end",
            Long.class);

    private final StringRedisTemplate redis;

    /**
     * @return 持有凭证；未抢到或 Redis 不可用时返回 null
     */
    public String tryAcquire(String key, Duration ttl) {
        String token = UUID.randomUUID().toString();
        try {
            Boolean ok = redis.opsForValue().setIfAbsent(key, token, ttl);
            return Boolean.TRUE.equals(ok) ? token : null;
        } catch (Exception e) {
            // Redis 挂了就没有共享缓存，预取本身也无意义，直接跳过
            log.warn("获取预取锁失败（Redis 不可用），本轮跳过: {}", e.getMessage());
            return null;
        }
    }

    public void release(String key, String token) {
        if (token == null) return;
        try {
            redis.execute(RELEASE, List.of(key), token);
        } catch (Exception e) {
            log.warn("释放预取锁失败，将等待 TTL 自动过期: {}", e.getMessage());
        }
    }
}
