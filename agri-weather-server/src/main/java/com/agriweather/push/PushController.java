package com.agriweather.push;

import com.agriweather.entity.PushSubscription;
import com.agriweather.repository.PushSubscriptionRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final WebPushService webPushService;
    private final PushSubscriptionRepository subscriptionRepository;

    @GetMapping("/public-key")
    public Map<String, Object> publicKey() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enabled", webPushService.isConfigured());
        result.put("publicKey", webPushService.publicKey());
        return result;
    }

    @PostMapping("/subscribe")
    public Map<String, Object> subscribe(@Valid @RequestBody PushSubscribeRequest body,
                                         HttpServletRequest request) {
        Long userId = requireUserId(request);
        PushSubscription subscription = subscriptionRepository.findByEndpoint(body.getEndpoint())
                .orElseGet(PushSubscription::new);
        // 同一浏览器换账号登录时，把订阅归属改到当前用户
        subscription.setUserId(userId);
        subscription.setEndpoint(body.getEndpoint());
        subscription.setP256dh(body.getP256dh());
        subscription.setAuth(body.getAuth());
        subscription.setUserAgent(body.getUserAgent());
        subscriptionRepository.save(subscription);
        return Map.of("subscribed", webPushService.isConfigured());
    }

    @DeleteMapping("/subscribe")
    public Map<String, Object> unsubscribe(@RequestBody Map<String, String> body,
                                           HttpServletRequest request) {
        Long userId = requireUserId(request);
        String endpoint = body.get("endpoint");
        if (endpoint != null && !endpoint.isBlank()) {
            subscriptionRepository.findByEndpoint(endpoint)
                    .filter(sub -> userId.equals(sub.getUserId()))
                    .ifPresent(subscriptionRepository::delete);
        }
        return Map.of("unsubscribed", true);
    }

    private Long requireUserId(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        return userId;
    }
}