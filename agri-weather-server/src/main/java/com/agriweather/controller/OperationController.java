package com.agriweather.controller;

import com.agriweather.service.OperationAdvisor;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/operations")
@RequiredArgsConstructor
public class OperationController {

    private final OperationAdvisor operationAdvisor;

    /**
     * 获取农事作业建议
     * POST /api/operations/advice/{farmlandId}
     * Body: [{date, tempMax, tempMin, humidity, rainfall, windSpeed, condition}, ...]
     */
    @PostMapping("/advice/{farmlandId}")
    public Map<String, Object> getAdvice(
            @PathVariable Long farmlandId,
            @RequestBody List<Map<String, Object>> weatherForecast) {
        return operationAdvisor.getOperationAdvice(farmlandId, weatherForecast);
    }
}
