package com.agriweather.service;

import com.agriweather.entity.CropGrowthStage;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmlandRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

/**
 * 农事作业智能指导引擎
 * 根据未来天气 + 作物阶段 → 推荐最佳农事窗口
 */
@Service
@RequiredArgsConstructor
public class OperationAdvisor {

    private final FarmlandRepository farmlandRepository;
    private final CropService cropService;

    /**
     * 生成未来7天农事日程建议
     * weatherForecast: [{date, tempMax, tempMin, humidity, rainfall, windSpeed, condition}]
     */
    public Map<String, Object> getOperationAdvice(Long farmlandId, List<Map<String, Object>> weatherForecast) {
        Farmland farmland = farmlandRepository.findById(farmlandId)
                .orElseThrow(() -> new RuntimeException("地块不存在"));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmlandName", farmland.getFieldName());

        if (farmland.getCropId() == null || farmland.getPlantDate() == null) {
            result.put("message", "请先设置作物和种植日期");
            return result;
        }

        CropGrowthStage stage = cropService.getCurrentStage(farmland.getCropId(), farmland.getPlantDate());
        result.put("currentStage", stage != null ? stage.getStageName() : "未知");

        List<Map<String, Object>> dailyAdvice = new ArrayList<>();
        List<String> allBans = new ArrayList<>();

        for (Map<String, Object> day : weatherForecast) {
            Map<String, Object> advice = new LinkedHashMap<>();
            advice.put("date", day.get("date"));

            double tempMax = ((Number) day.get("tempMax")).doubleValue();
            double tempMin = ((Number) day.get("tempMin")).doubleValue();
            double rainfall = ((Number) day.get("rainfall")).doubleValue();
            double windSpeed = ((Number) day.get("windSpeed")).doubleValue();
            String condition = (String) day.getOrDefault("condition", "");

            List<String> suitable = new ArrayList<>();
            List<String> banned = new ArrayList<>();

            // 播种建议
            if (stage.getStageName().contains("播种") || stage.getStageName().contains("育苗")) {
                if (rainfall < 5 && tempMin > 10 && windSpeed < 5) {
                    suitable.add("播种窗口期，地温适宜");
                } else {
                    banned.add("不宜播种（温度或降水不达标）");
                }
            }

            // 施肥建议
            if (windSpeed < 5 && tempMax < 35 && rainfall < 5) {
                suitable.add("适宜施肥");
            } else {
                if (windSpeed >= 5) banned.add("大风天气禁止施肥");
                if (tempMax >= 35) banned.add("高温午间禁止施肥");
                if (rainfall > 5) banned.add("雨天禁止施肥（肥料流失）");
            }

            // 打药建议
            if (rainfall == 0 && windSpeed < 3 && tempMax < 30) {
                suitable.add("适宜打药");
            } else {
                if (rainfall > 0) banned.add("雨天禁止喷药（药效流失）");
                if (windSpeed >= 3) banned.add("风速过大禁止喷药（飘移危害）");
            }

            // 灌溉建议
            if (rainfall < 2 && tempMax > 25) {
                suitable.add("建议灌溉补水");
            }
            if (rainfall > 20) {
                suitable.add("天然降水充足，无需灌溉");
            }

            // 采收建议
            if (stage.getStageName().contains("成熟") && rainfall < 5 && windSpeed < 5) {
                suitable.add("适宜采收");
            }

            // 作业禁令
            if (tempMax >= 35 && condition.contains("晴")) {
                banned.add("高温午间（11:00-15:00）停止田间作业");
            }

            advice.put("suitable", suitable);
            advice.put("banned", banned);
            dailyAdvice.add(advice);
            allBans.addAll(banned);
        }

        result.put("dailyAdvice", dailyAdvice);
        result.put("summary", generateSummary(dailyAdvice, allBans));

        return result;
    }

    private String generateSummary(List<Map<String, Object>> dailyAdvice, List<String> allBans) {
        long suitableDays = dailyAdvice.stream()
                .filter(d -> !((List<?>) d.get("suitable")).isEmpty()).count();

        Set<String> uniqueBans = new LinkedHashSet<>(allBans);

        StringBuilder sb = new StringBuilder();
        sb.append("未来7天中").append(suitableDays).append("天适宜农事作业。");
        if (!uniqueBans.isEmpty()) {
            sb.append("需注意：");
            for (String ban : uniqueBans) {
                sb.append("【").append(ban).append("】");
            }
        }
        return sb.toString();
    }
}
