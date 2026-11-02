package com.agriweather.push;

import com.agriweather.entity.PushSubscription;
import com.agriweather.repository.PushSubscriptionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Service;

import java.security.Security;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Web Push 发送：VAPID 签名由 web-push 库完成，发送失败不影响预警入库。
 *
 * 推送是尽力而为，404/410 视为订阅已失效并删除。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebPushService {

    private final PushProperties properties;
    private final PushSubscriptionRepository subscriptionRepository;
    private final ObjectMapper objectMapper;

    private PushService pushService;
    private ExecutorService executor;
    private final AtomicLong sentCount = new AtomicLong();
    private final AtomicLong failedCount = new AtomicLong();
    private final AtomicLong expiredCount = new AtomicLong();

    @PostConstruct
    void init() {
        if (!properties.isConfigured()) {
            log.info("未配置 VAPID 密钥，Web Push 已关闭");
            return;
        }
        try {
            Security.addProvider(new BouncyCastleProvider());
            pushService = new PushService(properties.getPublicKey(),
                    properties.getPrivateKey(), properties.getSubject());
            executor = Executors.newFixedThreadPool(2, runnable -> {
                Thread thread = new Thread(runnable, "web-push");
                thread.setDaemon(true);
                return thread;
            });
            log.info("Web Push 已启用");
        } catch (Exception e) {
            pushService = null;
            log.warn("Web Push 初始化失败，推送已关闭: {}", e.getMessage());
        }
    }

    @PreDestroy
    void shutdown() {
        if (executor != null) executor.shutdownNow();
    }

    public boolean isConfigured() {
        return pushService != null;
    }

    public String publicKey() {
        return properties.getPublicKey();
    }

    /** 异步推送，避免阻塞预警生成/接口响应 */
    public void notifyUserAsync(Long userId, String title, String body, String url) {
        if (pushService == null || userId == null) return;
        List<PushSubscription> subscriptions = subscriptionRepository.findByUserId(userId);
        if (subscriptions.isEmpty()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", title);
        payload.put("body", body);
        payload.put("url", url);
        payload.put("tag", "agri-alert");

        executor.submit(() -> sendAll(subscriptions, payload));
    }

    private void sendAll(List<PushSubscription> subscriptions, Map<String, Object> payload) {
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.warn("序列化推送内容失败: {}", e.getMessage());
            return;
        }

        for (PushSubscription subscription : subscriptions) {
            try {
                Notification notification = new Notification(
                        subscription.getEndpoint(),
                        subscription.getP256dh(),
                        subscription.getAuth(),
                        json);
                HttpResponse response = pushService.send(notification);
                int status = response.getStatusLine().getStatusCode();
                if (status >= 200 && status < 300) {
                    sentCount.incrementAndGet();
                    subscription.setLastSuccessAt(LocalDateTime.now());
                    subscriptionRepository.save(subscription);
                } else if (status == 404 || status == 410) {
                    // 浏览器已取消订阅
                    expiredCount.incrementAndGet();
                    subscriptionRepository.delete(subscription);
                } else {
                    failedCount.incrementAndGet();
                    log.warn("Web Push 返回 HTTP {} endpoint={}", status, safeEndpoint(subscription));
                }
            } catch (Exception e) {
                failedCount.incrementAndGet();
                log.warn("Web Push 发送失败 endpoint={}: {}", safeEndpoint(subscription), e.getMessage());
            }
        }
    }

    public Map<String, Object> metrics() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enabled", isConfigured());
        result.put("sent", sentCount.get());
        result.put("failed", failedCount.get());
        result.put("expired", expiredCount.get());
        return result;
    }

    private String safeEndpoint(PushSubscription subscription) {
        String endpoint = subscription.getEndpoint();
        if (endpoint == null || endpoint.length() <= 48) return endpoint;
        return endpoint.substring(0, 48) + "…";
    }
}