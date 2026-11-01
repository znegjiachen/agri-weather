package com.agriweather.weather;

import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.service.FarmlandWeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

/**
 * 定时检查全部地块的气象预警。
 *
 * 没有这个任务时，预警只会在用户打开预警页时生成；现在后台也会主动更新，
 * 前端在应用打开期间轮询未读数即可及时提醒。
 * 多实例用 Redis 锁保证同一轮只有一个实例执行。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertRefreshScheduler {

    private static final String LOCK_KEY = "agri:lock:alert-refresh";

    private final FarmlandRepository farmlandRepo;
    private final FarmlandWeatherService farmlandWeatherService;
    private final RedisLeaderLock lock;

    @Scheduled(
            initialDelayString = "${app.alerts.refresh-initial-delay-ms:120000}",
            fixedDelayString = "${app.alerts.refresh-interval-ms:1800000}")
    public void refreshAll() {
        String token = lock.tryAcquire(LOCK_KEY, Duration.ofMinutes(10));
        if (token == null) return;

        long started = System.currentTimeMillis();
        int checked = 0;
        int failed = 0;
        try {
            List<Farmland> fields = farmlandRepo.findAll();
            for (Farmland field : fields) {
                try {
                    farmlandWeatherService.checkAlerts(field.getId());
                    checked++;
                } catch (Exception e) {
                    failed++;
                    log.warn("定时预警检查失败 farmlandId={}: {}", field.getId(), e.getMessage());
                }
            }
            log.info("定时预警检查完成 checked={} failed={} cost={}ms",
                    checked, failed, System.currentTimeMillis() - started);
        } finally {
            lock.release(LOCK_KEY, token);
        }
    }
}