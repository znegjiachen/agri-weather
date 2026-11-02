package com.agriweather.controller;

import com.agriweather.weather.WeatherClient;
import com.agriweather.weather.WeatherFetch;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 天气页统一入口：走服务端缓存与 Open-Meteo / 和风天气备源。
 * 返回结构与 Open-Meteo 一致，前端不需要感知数据源。
 */
@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherClient weatherClient;

    @GetMapping
    public ResponseEntity<Map<String, Object>> forecast(@RequestParam double lat,
                                                        @RequestParam double lng,
                                                        HttpServletRequest request) {
        if (request.getAttribute("userId") == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        if (!Double.isFinite(lat) || lat < -90 || lat > 90) {
            throw new IllegalArgumentException("纬度需在 -90 ~ 90 之间");
        }
        if (!Double.isFinite(lng) || lng < -180 || lng > 180) {
            throw new IllegalArgumentException("经度需在 -180 ~ 180 之间");
        }

        WeatherFetch fetch = weatherClient.fetch(lat, lng);
        Map<String, Object> body = new LinkedHashMap<>(fetch.data());
        body.remove("_cache");
        return ResponseEntity.ok()
                .header("X-Weather-Cache", fetch.status().name())
                .body(body);
    }
}