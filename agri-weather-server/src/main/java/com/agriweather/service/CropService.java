package com.agriweather.service;

import com.agriweather.entity.CropGrowthStage;
import com.agriweather.entity.CropInfo;
import com.agriweather.repository.CropGrowthStageRepository;
import com.agriweather.repository.CropInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CropService {

    private final CropInfoRepository cropInfoRepository;
    private final CropGrowthStageRepository growthStageRepository;

    public List<CropInfo> listAll() {
        return cropInfoRepository.findAll();
    }

    public CropInfo getById(Long id) {
        return cropInfoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("作物不存在"));
    }

    public List<CropInfo> search(String keyword) {
        return cropInfoRepository.findByCropNameContaining(keyword);
    }

    public List<CropGrowthStage> getGrowthStages(Long cropId) {
        return growthStageRepository.findByCropIdOrderByStageOrder(cropId);
    }

    public CropGrowthStage getCurrentStage(Long cropId, LocalDate plantDate) {
        CropInfo crop = getById(cropId);
        long daysSincePlant = ChronoUnit.DAYS.between(plantDate, LocalDate.now());
        List<CropGrowthStage> stages = growthStageRepository.findByCropIdOrderByStageOrder(cropId);
        int accumulatedDays = 0;
        for (CropGrowthStage stage : stages) {
            accumulatedDays += stage.getStageDays() != null ? stage.getStageDays() : 0;
            if (daysSincePlant <= accumulatedDays) return stage;
        }
        return stages.isEmpty() ? null : stages.get(stages.size() - 1);
    }

    /**
     * 气象匹配检测（加权精确版）
     * 温度权重40%、湿度25%、降水20%、光照15%
     * 基于标准化距离计算单项分，加权汇总综合分
     */
    public Map<String, Object> getWeatherMatch(Long cropId, double temp, double humidity,
                                                double rainfall, double light) {
        CropInfo crop = getById(cropId);
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("cropName", crop.getCropName());
        report.put("variety", crop.getVariety());

        // ── 1. 温度评分（权重 40%）──
        double tempScore = scoreRange(temp, crop.getSuitableTempMin(), crop.getSuitableTempMax(), 8.0);
        String tempLabel = tempScore >= 85 ? "非常适宜" : tempScore >= 70 ? "适宜" : tempScore >= 50 ? "勉强" : "不适宜";
        report.put("temperature", Map.of(
            "score", Math.round(tempScore),
            "label", tempLabel,
            "current", Math.round(temp * 10) / 10.0,
            "range", crop.getSuitableTempMin() + "°C ~ " + crop.getSuitableTempMax() + "°C",
            "weight", 40
        ));

        // ── 2. 湿度评分（权重 25%）──
        double humScore = scoreRange(humidity, crop.getSuitableHumidityMin(), crop.getSuitableHumidityMax(), 15.0);
        String humLabel = humScore >= 85 ? "非常适宜" : humScore >= 70 ? "适宜" : humScore >= 50 ? "勉强" : "不适宜";
        report.put("humidity", Map.of(
            "score", Math.round(humScore),
            "label", humLabel,
            "current", Math.round(humidity * 10) / 10.0,
            "range", crop.getSuitableHumidityMin() + "% ~ " + crop.getSuitableHumidityMax() + "%",
            "weight", 25
        ));

        // ── 3. 降水评分（权重 20%）──
        double rainScore = scoreLowerIsBetter(rainfall, crop.getSuitableRainfall(), 200.0);
        String rainLabel = rainScore >= 85 ? "非常适宜" : rainScore >= 70 ? "适宜" : rainScore >= 50 ? "偏多" : "过多";
        report.put("rainfall", Map.of(
            "score", Math.round(rainScore),
            "label", rainLabel,
            "current", Math.round(rainfall * 10) / 10.0 + "mm",
            "reference", crop.getSuitableRainfall() + "mm",
            "weight", 20
        ));

        // ── 4. 光照评分（权重 15%）──
        double lightScore = scoreExact(light, crop.getSuitableLightHours(), 6.0);
        String lightLabel = lightScore >= 85 ? "非常适宜" : lightScore >= 70 ? "适宜" : lightScore >= 50 ? "不足/过多" : "严重不足";
        report.put("light", Map.of(
            "score", Math.round(lightScore),
            "label", lightLabel,
            "current", Math.round(light * 10) / 10.0 + "h",
            "reference", crop.getSuitableLightHours() + "h",
            "weight", 15
        ));

        // ── 5. 加权综合分 ──
        double weighted = tempScore * 0.40 + humScore * 0.25 + rainScore * 0.20 + lightScore * 0.15;
        int overall = (int) Math.round(weighted);
        report.put("overallScore", overall);
        report.put("overallGrade", overall >= 90 ? "优秀" : overall >= 75 ? "良好" : overall >= 60 ? "一般" : "较差");

        // ── 6. 灾害风险检测（惩罚扣分）──
        List<Map<String, String>> risks = new ArrayList<>();
        if (crop.getFrostSensitive() && temp < 5) {
            risks.add(Map.of("type", "FROST", "level", "RED", "msg",
                "低温冻害风险！" + crop.getCropName() + "不耐寒，当前" + temp + "°C远低于安全线"));
            overall = Math.max(0, overall - 25);
        } else if (crop.getFrostSensitive() && temp < 10) {
            risks.add(Map.of("type", "FROST", "level", "YELLOW", "msg",
                "注意低温，" + crop.getCropName() + "对低温敏感，当前" + temp + "°C"));
            overall = Math.max(0, overall - 10);
        }
        if (crop.getHeatSensitive() && temp > 35) {
            risks.add(Map.of("type", "HEAT", "level", "RED", "msg",
                "高温热害风险！" + crop.getCropName() + "不耐热，当前" + temp + "°C远超安全线"));
            overall = Math.max(0, overall - 25);
        } else if (crop.getHeatSensitive() && temp > 30) {
            risks.add(Map.of("type", "HEAT", "level", "YELLOW", "msg",
                "注意高温，" + crop.getCropName() + "对热敏感，当前" + temp + "°C"));
            overall = Math.max(0, overall - 10);
        }
        if (crop.getWaterlogSensitive() && rainfall > 80) {
            risks.add(Map.of("type", "RAINSTORM", "level", "RED", "msg",
                "暴雨涝害风险！" + crop.getCropName() + "怕涝，当前降水" + rainfall + "mm"));
            overall = Math.max(0, overall - 25);
        } else if (crop.getWaterlogSensitive() && rainfall > 50) {
            risks.add(Map.of("type", "RAINSTORM", "level", "YELLOW", "msg",
                "注意排水，" + crop.getCropName() + "对涝害敏感"));
            overall = Math.max(0, overall - 10);
        }
        report.put("risks", risks);
        report.put("hasRisk", !risks.isEmpty());
        report.put("finalScore", overall);
        report.put("finalGrade", overall >= 90 ? "优秀" : overall >= 75 ? "良好" : overall >= 60 ? "一般" : "较差");

        // ── 7. 综合建议 ──
        List<String> suggestions = new ArrayList<>();
        double tMin = crop.getSuitableTempMin() != null ? crop.getSuitableTempMin() : 15;
        double tMax = crop.getSuitableTempMax() != null ? crop.getSuitableTempMax() : 30;
        if (temp < tMin) suggestions.add("建议覆盖地膜或大棚保温，提升地温");
        if (temp > tMax) suggestions.add("建议遮阳降温，增加灌溉频率降低田间温度");
        if (humidity < (crop.getSuitableHumidityMin() != null ? crop.getSuitableHumidityMin() : 50))
            suggestions.add("建议喷灌增湿或浇跑马水提高田间湿度");
        if (humidity > (crop.getSuitableHumidityMax() != null ? crop.getSuitableHumidityMax() : 80))
            suggestions.add("建议通风降湿，预防病害滋生");
        if (rainfall > (crop.getSuitableRainfall() != null ? crop.getSuitableRainfall() : 100))
            suggestions.add("建议清沟排水，降低地下水位");
        if (light < (crop.getSuitableLightHours() != null ? crop.getSuitableLightHours() * 0.5 : 4))
            suggestions.add("连续阴雨寡照，注意补光或喷施叶面肥增强光合作用");
        report.put("suggestions", suggestions);

        return report;
    }

    // ──── 评分函数 ────

    /**
     * 区间型评分：值在 [min, max] 内满分，超出用高斯衰减
     * @param tolerance 容忍度（超出 tolerance 时降为 0 分）
     */
    private double scoreRange(double value, Double min, Double max, double tolerance) {
        if (min == null || max == null) return 50;
        double center = (min + max) / 2.0;
        double halfRange = (max - min) / 2.0;
        if (halfRange <= 0) return 50;
        double distance = Math.abs(value - center);
        if (distance <= halfRange) return 100;
        // 超出范围后，用余弦衰减
        double excess = distance - halfRange;
        double ratio = Math.min(excess / tolerance, 1.0);
        return 100 * (1 - ratio) * (1 - ratio * 0.3); // 非线性衰减
    }

    /**
     * 越小越好型评分：值 <= reference 满分，超出衰减
     */
    private double scoreLowerIsBetter(double value, Double reference, double tolerance) {
        if (reference == null) return 50;
        if (value <= reference) return 100;
        double excess = value - reference;
        double ratio = Math.min(excess / tolerance, 1.0);
        return 100 * (1 - ratio) * (1 - ratio * 0.3);
    }

    /**
     * 精确值型评分：越接近 reference 越高
     */
    private double scoreExact(double value, Double reference, double tolerance) {
        if (reference == null) return 50;
        double distance = Math.abs(value - reference);
        double ratio = Math.min(distance / tolerance, 1.0);
        return 100 * (1 - ratio) * (1 - ratio * 0.3);
    }
}
