package com.agriweather.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 清理「上传了但没发帖」的图片。
 *
 * 上传接口在编辑器里就会被调用（用户可能取消发帖），这些 blob 不清理会一直涨库。
 * 两个后端实例都会执行；DELETE 本身幂等，不需要分布式锁。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CommunityImageCleanupTask {

    private static final int ORPHAN_HOURS = 24;

    private final CommunityImageService imageService;

    @Scheduled(cron = "${app.community.image-cleanup-cron:0 17 3 * * *}")
    public void cleanup() {
        int deleted = imageService.cleanupOrphans(LocalDateTime.now().minusHours(ORPHAN_HOURS));
        if (deleted > 0) {
            log.info("清理未发布社区图片 {} 张", deleted);
        }
    }
}