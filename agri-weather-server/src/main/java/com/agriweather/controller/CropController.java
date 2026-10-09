package com.agriweather.controller;

import com.agriweather.entity.CropGrowthStage;
import com.agriweather.entity.CropInfo;
import com.agriweather.service.CropService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crops")
@RequiredArgsConstructor
public class CropController {

    private final CropService cropService;

    @GetMapping
    public List<CropInfo> listAll() {
        return cropService.listAll();
    }

    @GetMapping("/{id}")
    public CropInfo getById(@PathVariable Long id) {
        return cropService.getById(id);
    }

    @GetMapping("/search")
    public List<CropInfo> search(@RequestParam String keyword) {
        return cropService.search(keyword);
    }

    @GetMapping("/{id}/stages")
    public List<CropGrowthStage> getStages(@PathVariable Long id) {
        return cropService.getGrowthStages(id);
    }

    /**
     * 作物气象匹配报告
     * GET /api/crops/{id}/weather-match?temp=28&humidity=65&rainfall=10&light=8
     */
    @GetMapping("/{id}/weather-match")
    public Map<String, Object> weatherMatch(
            @PathVariable Long id,
            @RequestParam double temp,
            @RequestParam double humidity,
            @RequestParam double rainfall,
            @RequestParam double light) {
        return cropService.getWeatherMatch(id, temp, humidity, rainfall, light);
    }

    /**
     * 根据种植日期计算当前生长阶段
     * GET /api/crops/{id}/current-stage?plantDate=2026-03-15
     */
    @GetMapping("/{id}/current-stage")
    public CropGrowthStage getCurrentStage(
            @PathVariable Long id,
            @RequestParam String plantDate) {
        return cropService.getCurrentStage(id, LocalDate.parse(plantDate));
    }
}
