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
        List<CropGrowthStage> stages = growthStageRepository.findByCropIdOrderByStageOrder(cropId);
        if (!stages.isEmpty()) {
            return stages;
        }
        // 新增作物没有逐条维护阶段时，用通用四阶段兜底，避免详情页空白
        return defaultStages(getById(cropId));
    }

    public CropGrowthStage getCurrentStage(Long cropId, LocalDate plantDate) {
        long daysSincePlant = ChronoUnit.DAYS.between(plantDate, LocalDate.now());
        List<CropGrowthStage> stages = getGrowthStages(cropId);
        int accumulatedDays = 0;
        for (CropGrowthStage stage : stages) {
            accumulatedDays += stage.getStageDays() != null ? stage.getStageDays() : 0;
            if (daysSincePlant <= accumulatedDays) return stage;
        }
        return stages.isEmpty() ? null : stages.get(stages.size() - 1);
    }

    private List<CropGrowthStage> defaultStages(CropInfo crop) {
        int cycle = crop.getGrowthCycleDays() != null && crop.getGrowthCycleDays() > 0
                ? crop.getGrowthCycleDays() : 120;
        int[] percent = {20, 30, 30, 20};
        String[] names = {"播种/定植期", "营养生长期", "开花/产量形成期", "成熟采收期"};
        String[] risks = {"LOW", "MEDIUM", "HIGH", "MEDIUM"};
        String[] warnings = {
                "关注土壤墒情，确保出苗或定植成活",
                "加强水肥管理，定期巡查病虫",
                "产量形成关键期，保持适宜温湿度",
                "关注天气变化，适时采收"
        };

        double rainfall = crop.getSuitableRainfall() != null ? crop.getSuitableRainfall() : 400;
        List<CropGrowthStage> stages = new ArrayList<>();
        int allocated = 0;
        for (int i = 0; i < 4; i++) {
            int days = i == 3 ? Math.max(1, cycle - allocated)
                    : Math.max(1, (int) Math.round(cycle * percent[i] / 100.0));
            allocated += days;
            stages.add(CropGrowthStage.builder()
                    .cropId(crop.getId())
                    .stageName(names[i])
                    .stageOrder(i + 1)
                    .stageDays(days)
                    .tempMin(crop.getSuitableTempMin())
                    .tempMax(crop.getSuitableTempMax())
                    .humidityMin(crop.getSuitableHumidityMin())
                    .humidityMax(crop.getSuitableHumidityMax())
                    .rainfallNeed((double) Math.round(rainfall / 4))
                    .lightNeed(crop.getSuitableLightHours())
                    .pestRiskLevel(risks[i])
                    .keyWarnings(warnings[i])
                    .build());
        }
        return stages;
    }

    /**
     * 播种气象适宜度。
     *
     * 温度：按 QX/T 734—2024《关键农时气象服务通则》表 A.1 的播种界限温度，
     *       用日平均气温对 [sowingTempMin, sowingTempMax] 做分段线性评分；
     * 水分：空气湿度 + 当日降水。降水按 FAO EcoCrop 思路，把全生育期需水
     *       折算为日均需水，再按“偏少—适宜—偏多”分段评分；
     * 光照：作为辅助因子保留较低权重；
     * 综合：加权后叠加限制因子上限，避免某一项严重不适宜却被其他项拉高。
     */
    public Map<String, Object> getWeatherMatch(Long cropId, double temp, double humidity,
                                                double rainfall, double light) {
        CropInfo crop = getById(cropId);
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("cropName", crop.getCropName());
        report.put("variety", crop.getVariety());
        report.put("method", "QX/T 734—2024 播种界限温度 + FAO EcoCrop 分段响应");
        report.put("dataNote", "温度取未来 5 天日平均气温均值（近似稳定通过）；水分由空气湿度和当日降水估算，尚未接入 0–20 cm 土壤墒情");

        // ── 1. 播种温度（权重 50%，参考 QX/T 734—2024）──
        double tempMin = crop.getSowingTempMin() != null ? crop.getSowingTempMin()
                : (crop.getSuitableTempMin() != null ? crop.getSuitableTempMin() : 15);
        double tempMax = crop.getSowingTempMax() != null ? crop.getSowingTempMax()
                : (crop.getSuitableTempMax() != null ? crop.getSuitableTempMax() : 30);
        double tempScore = scoreSowingTemp(temp, tempMin, tempMax);
        String tempLabel = scoreLabel(tempScore);
        report.put("temperature", Map.of(
            "score", Math.round(tempScore),
            "label", tempLabel,
            "current", Math.round(temp * 10) / 10.0,
            "range", tempMin + "°C ~ " + tempMax + "°C",
            "weight", 50,
            "basis", "QX/T 734—2024 播种界限温度"
        ));

        // ── 2. 空气湿度（权重 10%，播种期采用通用适湿范围）──
        double humScore = Math.max(20, scoreRange(humidity, 50.0, 85.0, 20.0));
        String humLabel = scoreLabel(humScore);
        report.put("humidity", Map.of(
            "score", Math.round(humScore),
            "label", humLabel,
            "current", Math.round(humidity * 10) / 10.0,
            "range", "50% ~ 85%",
            "weight", 10,
            "basis", "通用播种空气湿度"
        ));

        // ── 3. 当日降水（权重 25%，按日均需水折算适宜区间）──
        double dailyNeed = crop.getSuitableRainfall() != null && crop.getGrowthCycleDays() != null
                && crop.getGrowthCycleDays() > 0
                ? crop.getSuitableRainfall() / crop.getGrowthCycleDays() : 4.0;
        double rainLow = Math.max(0.5, dailyNeed * 0.3);
        double rainHigh = Math.max(rainLow + 0.5, dailyNeed * 2.0);
        double rainScore = scoreSowingRain(rainfall, rainLow, rainHigh, dailyNeed);
        String rainLabel = rainfall < rainLow ? (rainScore < 50 ? "过少" : "偏少")
                : rainfall > rainHigh ? (rainScore < 50 ? "过多" : "偏多") : "适宜";
        report.put("rainfall", Map.of(
            "score", Math.round(rainScore),
            "label", rainLabel,
            "current", Math.round(rainfall * 10) / 10.0 + "mm",
            "reference", String.format(java.util.Locale.ROOT,
                "日均需水 %.1f mm（适播 %.1f~%.1f mm）", dailyNeed, rainLow, rainHigh),
            "weight", 25
        ));

        // ── 4. 光照（权重 15%，辅助因子）──
        double lightScore = scoreDaylight(light, crop.getSuitableLightHours());
        String lightLabel = lightScore >= 85 ? "非常适宜" : lightScore >= 70 ? "适宜"
                : lightScore >= 50 ? "不足/过多" : "严重不足";
        report.put("light", Map.of(
            "score", Math.round(lightScore),
            "label", lightLabel,
            "current", Math.round(light * 10) / 10.0 + "h",
            "reference", crop.getSuitableLightHours() + "h",
            "weight", 15
        ));

        // ── 5. 综合分：加权 + 限制因子封顶 ──
        double moistureScore = humScore * 0.29 + rainScore * 0.71;
        double weighted = tempScore * 0.50 + moistureScore * 0.35 + lightScore * 0.15;
        double limited = Math.min(weighted, Math.min(tempScore + 20, moistureScore + 20));
        int overall = (int) Math.round(Math.max(0, limited));
        report.put("overallScore", overall);
        report.put("overallGrade", gradeOf(overall));

        // ── 6. 灾害风险检测（惩罚扣分）──
        List<Map<String, String>> risks = new ArrayList<>();
        if (crop.getFrostSensitive() && temp < tempMin - 4) {
            risks.add(Map.of("type", "FROST", "level", "RED", "msg",
                "低温冻害风险！" + crop.getCropName() + "播种下限 " + tempMin
                    + "°C，当前日均温仅 " + temp + "°C"));
            overall = Math.max(0, overall - 25);
        } else if (crop.getFrostSensitive() && temp < tempMin) {
            risks.add(Map.of("type", "FROST", "level", "YELLOW", "msg",
                "日均温低于" + crop.getCropName() + "播种下限 " + tempMin + "°C，建议等温度稳定通过"));
            overall = Math.max(0, overall - 10);
        }
        if (crop.getHeatSensitive() && temp > tempMax + 5) {
            risks.add(Map.of("type", "HEAT", "level", "RED", "msg",
                "高温风险！" + crop.getCropName() + "播种上限 " + tempMax
                    + "°C，当前日均温 " + temp + "°C"));
            overall = Math.max(0, overall - 25);
        } else if (crop.getHeatSensitive() && temp > tempMax) {
            risks.add(Map.of("type", "HEAT", "level", "YELLOW", "msg",
                "日均温高于" + crop.getCropName() + "播种上限 " + tempMax + "°C，建议推迟播种"));
            overall = Math.max(0, overall - 10);
        }
        if (crop.getWaterlogSensitive() && rainfall > rainHigh * 3) {
            risks.add(Map.of("type", "RAINSTORM", "level", "RED", "msg",
                "强降水涝害风险！" + crop.getCropName() + "怕涝，当日降水 " + rainfall + " mm"));
            overall = Math.max(0, overall - 25);
        } else if (crop.getWaterlogSensitive() && rainfall > rainHigh * 1.5) {
            risks.add(Map.of("type", "RAINSTORM", "level", "YELLOW", "msg",
                "降水偏多，" + crop.getCropName() + "播种后注意排水散墒"));
            overall = Math.max(0, overall - 10);
        }
        report.put("risks", risks);
        report.put("hasRisk", !risks.isEmpty());
        report.put("finalScore", overall);
        report.put("finalGrade", gradeOf(overall));

        // ── 7. 综合建议 ──
        List<String> suggestions = new ArrayList<>();
        if (temp < tempMin) {
            suggestions.add("日均温低于播种下限 " + tempMin + "°C，建议等温度稳定通过后再播");
        }
        if (temp > tempMax) {
            suggestions.add("日均温高于播种上限 " + tempMax + "°C，建议推迟播种或选耐热品种");
        }
        if (humidity < 50)
            suggestions.add("空气偏干，播前注意造墒或灌溉");
        if (humidity > 85)
            suggestions.add("空气偏湿，注意通风散墒，预防烂种和苗期病害");
        if (rainfall < rainLow)
            suggestions.add("当日降水偏少，播前需灌溉造墒或覆盖保墒");
        if (rainfall > rainHigh)
            suggestions.add("当日降水偏多，先排水散墒，避免烂种烂芽");
        if (light < (crop.getSuitableLightHours() != null ? crop.getSuitableLightHours() * 0.5 : 4))
            suggestions.add("光照偏少，注意播种深度和出苗后的光照管理");
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
     * 播种温度评分：日平均气温落在 [min, max] 内满分，越界按余弦式衰减。
     * min/max 取自 QX/T 734—2024 的播种界限温度。
     */
    private double scoreSowingTemp(double value, double min, double max) {
        if (value >= min && value <= max) return 100;
        double tolerance = Math.max(6.0, (max - min) * 0.5);
        double distance = value < min ? min - value : value - max;
        double ratio = Math.min(distance / tolerance, 1.0);
        return 100 * (1 - ratio) * (1 - ratio * 0.3);
    }

    /**
     * 播种降水评分：按日均需水折算的适宜区间分段。
     * 无降水仍可通过灌溉造墒，给 55 分兜底；超过上限后快速衰减。
     */
    private double scoreSowingRain(double value, double low, double high, double dailyNeed) {
        if (value >= low && value <= high) return 100;
        if (value < low) {
            return 55 + 45 * Math.max(0, value) / low;
        }
        double limit = Math.max(high + 0.5, dailyNeed * 6.0);
        double ratio = Math.min((value - high) / (limit - high), 1.0);
        return 100 * (1 - ratio);
    }

    private String scoreLabel(double score) {
        return score >= 85 ? "非常适宜" : score >= 70 ? "适宜" : score >= 50 ? "勉强" : "不适宜";
    }

    private String gradeOf(int score) {
        return score >= 90 ? "优秀" : score >= 75 ? "良好" : score >= 60 ? "一般" : "较差";
    }

    /**
     * 日照评分：达到作物需光时数即满分，不足时线性下降。
     * 播种期光照只作辅助，不因日照略多而扣分。
     */
    private double scoreDaylight(double value, Double need) {
        if (need == null || need <= 0) return 100;
        if (value >= need) return 100;
        return 40 + 60 * Math.max(0, value) / need;
    }
}
