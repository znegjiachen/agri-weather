package com.agriweather.controller;

import com.agriweather.dto.AlertResult;
import com.agriweather.entity.WeatherAlert;
import com.agriweather.service.AlertService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class AlertController {

    private final AlertService alertService;

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
    public List<WeatherAlert> listMine(HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        return alertService.getUserAlerts(userId);
    }

    @GetMapping("/unread-count")
    public long unreadCount(HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        return alertService.getUnreadCount(userId);
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
