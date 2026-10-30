package com.agriweather.controller;

import com.agriweather.dto.AlertResult;
import com.agriweather.entity.Farmland;
import com.agriweather.entity.WeatherAlert;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.service.AlertService;
import com.agriweather.service.FarmlandWeatherService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;
    private final FarmlandRepository farmlandRepository;
    private final FarmlandWeatherService farmlandWeatherService;

    /**
     * 对地块执行预警检查
     * GET /api/alerts/check/{farmlandId}?temp=28&humidity=65&rainfall=10&windSpeed=3&rainDays=2
     */
    @GetMapping("/check/{farmlandId}")
    public List<AlertResult> checkFarmland(
            @PathVariable Long farmlandId,
            @RequestParam double temp,
            @RequestParam double humidity,
            @RequestParam double rainfall,
            @RequestParam(defaultValue = "0") double windSpeed,
            @RequestParam(defaultValue = "0") int rainDays) {
        return alertService.checkFarmland(farmlandId, temp, humidity, rainfall, windSpeed, rainDays);
    }

    @GetMapping
    public List<WeatherAlert> listMine(@RequestParam(defaultValue = "all") String status,
                                        @RequestParam(defaultValue = "200") int limit,
                                        HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        return alertService.getUserAlerts(userId, status, limit);
    }

    @GetMapping("/unread-count")
    public long unreadCount(HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        return alertService.getUnreadCount(userId);
    }

    /**
     * 立即检查当前用户全部地块并生成/更新预警。
     * 页面刷新和「立即检查」按钮共用，避免预警必须手动点地块才更新。
     */
    @PostMapping("/refresh")
    public Map<String, Object> refresh(HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        List<Farmland> fields = farmlandRepository.findByUserId(userId);
        int checked = 0;
        int failed = 0;
        for (Farmland field : fields) {
            try {
                farmlandWeatherService.checkAlerts(field.getId());
                checked++;
            } catch (Exception e) {
                failed++;
                log.warn("地块预警检查失败 farmlandId={}: {}", field.getId(), e.getMessage());
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("checked", checked);
        result.put("failed", failed);
        return result;
    }

    @PutMapping("/{id}/handle")
    public void markHandled(@PathVariable Long id, HttpServletRequest request) {
        alertService.markHandled(id, getUserIdOrAuthError(request));
    }

    @PutMapping("/{id}/read")
    public void markRead(@PathVariable Long id, HttpServletRequest request) {
        alertService.markAsRead(id, getUserIdOrAuthError(request));
    }

    @PutMapping("/read-all")
    public void markAllRead(HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        alertService.markAllAsRead(userId);
    }

    private Long getUserIdOrAuthError(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        return userId;
    }
}
