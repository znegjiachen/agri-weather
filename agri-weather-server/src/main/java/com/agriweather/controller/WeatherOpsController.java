package com.agriweather.controller;

import com.agriweather.weather.WeatherCacheMetrics;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 天气缓存的运维观测接口。
 * 用来验证缓存是否真的生效，以及为压测前后对比提供命中率。
 */
@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherOpsController {

    private final WeatherCacheMetrics metrics;

    @GetMapping("/cache-stats")
    public Map<String, Object> stats() {
        return metrics.snapshot();
    }

    /** 压测前清零，便于算单轮命中率 */
    @PostMapping("/cache-stats/reset")
    public Map<String, Object> reset() {
        metrics.reset();
        return Map.of("reset", true);
    }
}
