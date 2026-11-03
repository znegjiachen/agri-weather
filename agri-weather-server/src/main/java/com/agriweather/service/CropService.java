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
        double tempOptMin = crop.getSowingTempOptimalMin() != null
                ? crop.getSowingTempOptimalMin() : tempMin;
        double tempOptMax = crop.getSowingTempOptimalMax() != null
                ? crop.getSowingTempOptimalMax() : tempMax;
        // 防止数据异常导致最佳区间越界
        tempOptMin = Math.max(tempMin, Math.min(tempOptMin, tempMax));
        tempOptMax = Math.min(tempMax, Math.max(tempOptMax, tempOptMin));
        double tempScore = scoreSowingTemp(temp, tempMin, tempOptMin, tempOptMax, tempMax);
        String tempLabel = scoreLabel(tempScore);
        report.put("temperature", Map.of(
            "score", Math.round(tempScore),
            "label", tempLabel,
            "current", Math.round(temp * 10) / 10.0,
            "range", num(tempMin) + "°C ~ " + num(tempMax)
                + "°C（最佳 " + num(tempOptMin) + "–" + num(tempOptMax) + "°C）",
            "weight", 50,
            "basis", "QX/T 734—2024 播种界限温度 + 最佳播温区间"
        ));

        // ── 2. 空气湿度（权重 10%，最佳 55–85%）──
        double humScore = scoreFourPoint(humidity, 40, 55, 85, 95, 60);
        String humLabel = scoreLabel(humScore);
        report.put("humidity", Map.of(
            "score", Math.round(humScore),
            "label", humLabel,
            "current", Math.round(humidity * 10) / 10.0,
            "range", "40% ~ 95%（最佳 55–85%）",
            "weight", 10,
            "basis", "通用播种空气湿度"
        ));

        // ── 3. 当日降水（权重 25%，按日均需水折算最佳区间）──
        double dailyNeed = crop.getSuitableRainfall() != null && crop.getGrowthCycleDays() != null
                && crop.getGrowthCycleDays() > 0
                ? crop.getSuitableRainfall() / crop.getGrowthCycleDays() : 4.0;
        double rainOptLow = dailyNeed * 0.5;
        double rainOptHigh = dailyNeed * 1.5;
        double rainAbsHigh = dailyNeed * 3.0;
        double rainScore = scoreSowingRain(rainfall, rainOptLow, rainOptHigh, rainAbsHigh, dailyNeed);
        String rainLabel = rainfall < rainOptLow
                ? (rainfall < rainOptLow * 0.4 ? "过少" : "偏少")
                : rainfall > rainOptHigh
                    ? (rainfall > rainAbsHigh ? "过多" : "偏多")
                    : "适宜";
        report.put("rainfall", Map.of(
            "score", Math.round(rainScore),
            "label", rainLabel,
            "current", Math.round(rainfall * 10) / 10.0 + "mm",
            "reference", String.format(java.util.Locale.ROOT,
                "日均需水 %.1f mm（最佳 %.1f~%.1f mm）", dailyNeed, rainOptLow, rainOptHigh),
            "weight", 25
        ));

        // ── 4. 光照（权重 15%，达到需光 80% 即进入最佳区）──
        double lightNeed = crop.getSuitableLightHours() != null ? crop.getSuitableLightHours() : 8.0;
        double lightOptMin = lightNeed * 0.8;
        double lightScore = scoreLight(light, lightNeed * 0.5, lightOptMin);
        String lightLabel = lightScore >= 85 ? "充足" : lightScore >= 70 ? "基本充足"
                : lightScore >= 50 ? "偏少" : "不足";
        report.put("light", Map.of(
            "score", Math.round(lightScore),
            "label", lightLabel,
            "current", Math.round(light * 10) / 10.0 + "h",
            "reference", "≥" + num(lightOptMin) + "h 充足（作物需光 " + num(lightNeed) + "h）",
            "weight", 15
        ));

        // ── 5. 综合分：加权 + 限制因子封顶 ──
        double moistureScore = humScore * 0.29 + rainScore * 0.71;
        double weighted = tempScore * 0.50 + moistureScore * 0.35 + lightScore * 0.15;
        double limited = Math.min(
            weighted,
            Math.min(tempScore + 10, Math.min(moistureScore + 10, lightScore + 15)));
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
        if (crop.getWaterlogSensitive() && rainfall > rainAbsHigh * 2) {
            risks.add(Map.of("type", "RAINSTORM", "level", "RED", "msg",
                "强降水涝害风险！" + crop.getCropName() + "怕涝，当日降水 " + rainfall + " mm"));
            overall = Math.max(0, overall - 25);
        } else if (crop.getWaterlogSensitive() && rainfall > rainAbsHigh) {
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
        if (humidity < 55)
            suggestions.add("空气偏干，播前注意造墒或灌溉");
        if (humidity > 85)
            suggestions.add("空气偏湿，注意通风散墒，预防烂种和苗期病害");
        if (rainfall < rainOptLow)
            suggestions.add("当日降水偏少，播前需灌溉造墒或覆盖保墒");
        if (rainfall > rainOptHigh)
            suggestions.add("当日降水偏多，先排水散墒，避免烂种烂芽");
        if (light < lightOptMin)
            suggestions.add("光照偏少，注意播种深度和出苗后的光照管理");
        report.put("suggestions", suggestions);

        return report;
    }

    // ──── 评分函数 ────

    /**
     * 四断点响应（FAO EcoCrop）：[optMin, optMax] 内 100 分；
     * 适宜区间边缘（min/max）为 edge 分；超出适宜区间后衰减到 0。
     */
    private double scoreFourPoint(double value, double min, double optMin,
                                  double optMax, double max, double edge) {
        if (value >= optMin && value <= optMax) return 100;
        if (value >= min && value < optMin) {
            double span = Math.max(0.01, optMin - min);
            return edge + (100 - edge) * (value - min) / span;
        }
        if (value > optMax && value <= max) {
            double span = Math.max(0.01, max - optMax);
            return edge + (100 - edge) * (max - value) / span;
        }
        double tolerance = Math.max(1.0, (max - min) * 0.3);
        double distance = value < min ? min - value : value - max;
        double ratio = Math.min(distance / tolerance, 1.0);
        return edge * (1 - ratio) * (1 - ratio * 0.3);
    }

    /**
     * 播种温度评分：四断点折线（FAO EcoCrop 响应函数）。
     * [optMin, optMax] 内满分；适宜区间边缘（min/max）为 60 分；
     * 超出适宜区间后继续衰减到 0。
     */
    private double scoreSowingTemp(double value, double min, double optMin,
                                   double optMax, double max) {
        return scoreFourPoint(value, min, optMin, optMax, max, 60);
    }

    /**
     * 播种降水评分：最佳区间 [optLow, optHigh] 满分；
     * 0 降水给 55 分兜底（可灌溉造墒）；超过 absHigh 后衰减到 0。
     */
    private double scoreSowingRain(double value, double optLow, double optHigh,
                                   double absHigh, double dailyNeed) {
        if (value >= optLow && value <= optHigh) return 100;
        if (value < optLow) {
            return 55 + 45 * Math.max(0, value) / Math.max(0.01, optLow);
        }
        if (value <= absHigh) {
            double span = Math.max(0.01, absHigh - optHigh);
            return 60 + 40 * (absHigh - value) / span;
        }
        double limit = Math.max(absHigh + 0.5, dailyNeed * 6.0);
        double ratio = Math.min((value - absHigh) / (limit - absHigh), 1.0);
        return 60 * (1 - ratio);
    }

    private String scoreLabel(double score) {
        return score >= 85 ? "非常适宜" : score >= 70 ? "适宜" : score >= 50 ? "勉强" : "不适宜";
    }

    private String num(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }

    private String gradeOf(int score) {
        return score >= 90 ? "优秀" : score >= 75 ? "良好" : score >= 60 ? "一般" : "较差";
    }

    /**
     * 日照评分：达到最佳下限（需光 80%）即满分，低于该值按比例下降；
     * 播种期光照只作辅助，不因日照偏多扣分。
     */
    private double scoreLight(double value, double absMin, double optMin) {
        if (value >= optMin) return 100;
        if (value >= absMin) {
            return 60 + 40 * (value - absMin) / Math.max(0.01, optMin - absMin);
        }
        return 60 * Math.max(0, value) / Math.max(0.01, absMin);
    }
}
