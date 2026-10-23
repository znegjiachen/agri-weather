package com.agriweather.weather;

import com.agriweather.repository.FarmlandRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 定时把所有地块的（去重）坐标预热进 Redis。
 *
 * 目的：让用户请求永远命中缓存，而不是在请求路径上同步等上游。
 *
 * 多实例下用 Redis 锁保证同一轮只有一个实例真正执行，
 * 否则 N 个实例会把上游调用放大 N 倍。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherPrefetchScheduler {

    private static final String LOCK_KEY = "agri:lock:weather-prefetch";

    /** 上一次预取完成的时间戳（秒）。锁只防并发，这个键防「前一个实例刚跑完，后一个接着跑」 */
    private static final String LAST_RUN_KEY = "agri:meta:weather-prefetch:last-run";

    private final FarmlandRepository farmlandRepo;
    private final WeatherClient weatherClient;
    private final WeatherProperties props;
    private final RedisLeaderLock lock;
    private final StringRedisTemplate redis;

    @Value("${INSTANCE_ID:local}")
    private String instanceId;

    @Scheduled(
            initialDelayString = "${app.weather.prefetch-initial-delay-ms:60000}",
            fixedDelayString = "${app.weather.prefetch-interval-ms:1200000}")
    public void prefetch() {
        if (!props.isPrefetchEnabled()) {
            return;
        }

        long cooldownSeconds = Math.max(60, props.getPrefetchIntervalMs() / 2000);
        if (inCooldown(cooldownSeconds)) {
            return;
        }

        String token = lock.tryAcquire(LOCK_KEY, Duration.ofSeconds(props.getPrefetchLockTtlSeconds()));
        if (token == null) {
            log.debug("[{}] 另一实例持有预取锁，本轮跳过", instanceId);
            return;
        }

        long start = System.currentTimeMillis();
        try {
            List<Object[]> coords = farmlandRepo.findDistinctCoordinates();
            int limit = Math.min(coords.size(), props.getPrefetchMaxCoords());
            int warmed = 0;
            int failed = 0;

            for (int i = 0; i < limit; i++) {
                Object[] c = coords.get(i);
                try {
                    // 强制回源，否则新鲜期内的条目全是 HIT，预取没有意义
                    weatherClient.fetch(((Number) c[0]).doubleValue(),
                            ((Number) c[1]).doubleValue(), true);
                    warmed++;
                } catch (Exception e) {
                    failed++;
                }
                if (i < limit - 1) {
                    Thread.sleep(props.getPrefetchSpacingMs());
                }
            }
            markDone(cooldownSeconds);
            log.info("[{}] 天气预取完成: 唯一坐标 {} 个（上限 {}），成功 {}，失败 {}，耗时 {}ms",
                    instanceId, coords.size(), limit, warmed, failed,
                    System.currentTimeMillis() - start);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("[{}] 天气预取异常: {}", instanceId, e.getMessage());
        } finally {
            lock.release(LOCK_KEY, token);
        }
    }

    /** 冷却期内说明别的实例刚预取过，本轮直接跳过 */
    private boolean inCooldown(long cooldownSeconds) {
        try {
            String last = redis.opsForValue().get(LAST_RUN_KEY);
            if (last == null) return false;
            long age = Instant.now().getEpochSecond() - Long.parseLong(last);
            if (age < cooldownSeconds) {
                log.debug("[{}] 距上次预取仅 {}s（冷却 {}s），本轮跳过", instanceId, age, cooldownSeconds);
                return true;
            }
            return false;
        } catch (Exception e) {
            // Redis 读不到就当作未冷却，交给后面的锁来兜底
            return false;
        }
    }

    private void markDone(long cooldownSeconds) {
        try {
            redis.opsForValue().set(LAST_RUN_KEY,
                    String.valueOf(Instant.now().getEpochSecond()),
                    Duration.ofSeconds(cooldownSeconds));
        } catch (Exception e) {
            log.warn("[{}] 记录预取时间失败: {}", instanceId, e.getMessage());
        }
    }
}
