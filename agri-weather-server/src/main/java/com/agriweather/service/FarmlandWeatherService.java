package com.agriweather.service;

import com.agriweather.entity.*;
import com.agriweather.repository.*;
import com.agriweather.weather.WeatherClient;
import com.agriweather.weather.WeatherFetch;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FarmlandWeatherService {

    private final FarmlandRepository farmlandRepo;
    private final CropInfoRepository cropRepo;
    private final CropGrowthStageRepository stageRepo;
    private final WeatherAlertRepository alertRepo;

    /** 外呼与缓存都收敛在这一层，本类不再直接碰 HTTP */
    private final WeatherClient weatherClient;

    /**
     * 取某地块的天气：先按经纬度拿（可跨地块共享的）预报，再叠加地块/作物元信息。
     *
     * 返回的 Map 里带一个 {@code _cache} 键表示数据来源（HIT/MISS/STALE/BYPASS），
     * 由 Controller 取出后写进响应头并从响应体里移除。
     */
    public Map<String, Object> fetchWeather(Long farmlandId) {
        Farmland f = farmlandRepo.findById(farmlandId)
                .orElseThrow(() -> new IllegalArgumentException("地块不存在（ID=" + farmlandId + "）"));

        if (f.getLat() == null || f.getLng() == null) {
            throw new IllegalArgumentException("该地块尚未设置经纬度，无法查询天气");
        }

        WeatherFetch wf = weatherClient.fetch(f.getLat(), f.getLng());

        // 拷贝一份：缓存里的是共享数据，不能就地修改
        Map<String, Object> data = new LinkedHashMap<>(wf.data());
        data.put("farmlandName", f.getFieldName());
        data.put("farmlandId", f.getId());
        if (f.getCropId() != null) {
            cropRepo.findById(f.getCropId()).ifPresent(c -> {
                data.put("cropName", c.getCropName());
                data.put("cropId", c.getId());
            });
        }
        data.put("_cache", wf.status().name());
        return data;
    }

    /**
     * 获取地块已有的预警记录（不重复生成）
     */
    public List<WeatherAlert> getExistingAlerts(Long farmlandId) {
        return alertRepo.findByFarmlandIdOrderByAlertTimeDesc(farmlandId);
    }

    /**
     * 执行一次预警检查（去重：今天同类型不重复保存）
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> checkAlerts(Long farmlandId) throws Exception {
        Farmland f = farmlandRepo.findById(farmlandId)
                .orElseThrow(() -> new RuntimeException("地块不存在"));
        if (f.getCropId() == null) return List.of(Map.of("type","INFO","level","BLUE","content","请先设置地块的作物","suggestion",""));

        CropInfo crop = cropRepo.findById(f.getCropId()).orElse(null);
        if (crop == null) return List.of();

        // 获取当前生长阶段
        List<CropGrowthStage> stages = stageRepo.findByCropIdOrderByStageOrder(f.getCropId());
        CropGrowthStage currentStage = null;
        if (f.getPlantDate() != null && !stages.isEmpty()) {
            long daysSincePlant = ChronoUnit.DAYS.between(f.getPlantDate(), LocalDate.now());
            int acc = 0;
            for (CropGrowthStage s : stages) {
                acc += s.getStageDays() != null ? s.getStageDays() : 0;
                if (daysSincePlant <= acc) { currentStage = s; break; }
            }
            if (currentStage == null) currentStage = stages.get(stages.size() - 1);
        }

        // 获取未来 24 小时预报：预警应基于预报极值，而不是只看此刻的瞬时温度
        Map<String, Object> weather = fetchWeather(farmlandId);
        Map<String, Object> current = (Map<String, Object>) weather.get("current");
        Map<String, Object> daily = (Map<String, Object>) weather.get("daily");
        double currentTemp = current != null ? num(current.get("temperature_2m"), 0) : 0;
        double currentWind = current != null ? num(current.get("wind_speed_10m"), 0) : 0;

        double nextMin = Math.min(
                numAt((List<Number>) daily.get("temperature_2m_min"), 0, currentTemp),
                numAt((List<Number>) daily.get("temperature_2m_min"), 1, currentTemp));
        double nextMax = Math.max(
                numAt((List<Number>) daily.get("temperature_2m_max"), 0, currentTemp),
                numAt((List<Number>) daily.get("temperature_2m_max"), 1, currentTemp));
        double rain24 = numAt((List<Number>) daily.get("precipitation_sum"), 0, 0)
                + numAt((List<Number>) daily.get("precipitation_sum"), 1, 0);
        double windMax = Math.max(
                numAt((List<Number>) daily.get("wind_speed_10m_max"), 0, currentWind),
                numAt((List<Number>) daily.get("wind_speed_10m_max"), 1, currentWind));

        List<Map<String, Object>> alerts = new ArrayList<>();

        // 作物本身的温度/涝害敏感
        if (Boolean.TRUE.equals(crop.getFrostSensitive()) && nextMin < 5) {
            String level = nextMin < 0 ? "RED" : "ORANGE";
            alerts.add(alert("FROST", level,
                    String.format("%s未来24小时最低气温%.1f°C，低于5°C，存在冻害风险。", f.getFieldName(), nextMin),
                    "覆盖薄膜、熏烟增温；已受冻地块喷施叶面肥恢复。"));
        }
        if (Boolean.TRUE.equals(crop.getHeatSensitive()) && nextMax > 35) {
            String level = nextMax > 40 ? "RED" : "ORANGE";
            alerts.add(alert("HEAT", level,
                    String.format("%s未来24小时最高气温%.1f°C，超过35°C，%s怕热。", f.getFieldName(), nextMax, crop.getCropName()),
                    "遮阳降温、增加灌溉；11:00-15:00 避免田间作业。"));
        }
        if (Boolean.TRUE.equals(crop.getWaterlogSensitive()) && rain24 > 50) {
            String level = rain24 > 80 ? "RED" : "YELLOW";
            alerts.add(alert("RAINSTORM", level,
                    String.format("%s未来24小时降水%.0fmm，%s怕涝。", f.getFieldName(), rain24, crop.getCropName()),
                    "疏通沟渠、及时排水；暴雨期间停止田间作业。"));
        }

        // 当前生长阶段的适宜温度
        if (currentStage != null) {
            if (currentStage.getTempMax() != null && nextMax > currentStage.getTempMax()) {
                double diff = nextMax - currentStage.getTempMax();
                alerts.add(alert("TEMP_HIGH", diff > 5 ? "RED" : "ORANGE",
                        String.format("%s处于%s，适宜温度≤%.0f°C，未来24小时最高%.1f°C偏高。",
                                crop.getCropName(), currentStage.getStageName(), currentStage.getTempMax(), nextMax),
                        "加强通风、遮阳降温；避开午间高温时段作业。"));
            }
            if (currentStage.getTempMin() != null && nextMin < currentStage.getTempMin()) {
                double diff = currentStage.getTempMin() - nextMin;
                alerts.add(alert("TEMP_LOW", diff > 5 ? "RED" : "ORANGE",
                        String.format("%s处于%s，适宜温度≥%.0f°C，未来24小时最低%.1f°C偏低。",
                                crop.getCropName(), currentStage.getStageName(), currentStage.getTempMin(), nextMin),
                        "覆膜保温、夜间熏烟防霜；低温过后检查受冻情况。"));
            }
        }

        if (windMax > 8) {
            String level = windMax > 12 ? "ORANGE" : "YELLOW";
            alerts.add(alert("WIND", level,
                    String.format("未来24小时最大风速%.1f km/h，超过8 km/h 安全阈值。", windMax),
                    "暂停打药施肥和高空作业；检查大棚、支架加固。"));
        }

        // 去重并更新：同一天、同一地块、同一类型只保留一条；条件变化时刷新级别并重新标记未读
        LocalDate today = LocalDate.now();
        List<WeatherAlert> existingBefore = alertRepo.findByFarmlandIdOrderByAlertTimeDesc(f.getId());
        Map<String, WeatherAlert> todayByType = new LinkedHashMap<>();
        for (WeatherAlert e : existingBefore) {
            if (e.getAlertTime() != null && today.equals(e.getAlertTime().toLocalDate())) {
                todayByType.putIfAbsent(e.getAlertType(), e);
            }
        }

        for (Map<String, Object> a : alerts) {
            String type = (String) a.get("type");
            String level = (String) a.get("level");
            String content = (String) a.get("content");
            String suggestion = (String) a.get("suggestion");
            WeatherAlert existing = todayByType.get(type);
            if (existing != null) {
                boolean changed = !Objects.equals(existing.getAlertLevel(), level)
                        || !Objects.equals(existing.getAlertContent(), content)
                        || !Objects.equals(existing.getSuggestion(), suggestion);
                existing.setAlertLevel(level);
                existing.setAlertContent(content);
                existing.setSuggestion(suggestion);
                existing.setAlertTime(LocalDateTime.now());
                if (changed) {
                    existing.setIsRead(false);
                    existing.setIsHandled(false);
                }
                alertRepo.save(existing);
            } else {
                alertRepo.save(WeatherAlert.builder()
                        .userId(f.getUserId()).farmlandId(f.getId())
                        .alertType(type)
                        .alertLevel(level)
                        .alertContent(content)
                        .suggestion(suggestion)
                        .alertTime(LocalDateTime.now())
                        .build());
            }
        }

        // 追加历史预警。本次已经算出来的类型不再从库里补一遍 ——
        // 否则刚保存的预警会被查回来重复返回。
        Set<String> currentTypes = alerts.stream()
                .map(m -> (String) m.get("type"))
                .collect(Collectors.toSet());
        for (WeatherAlert e : existingBefore) {
            boolean sameTypeToday = currentTypes.contains(e.getAlertType())
                    && e.getAlertTime() != null
                    && today.equals(e.getAlertTime().toLocalDate());
            if (sameTypeToday) continue;

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("type", e.getAlertType());
            m.put("level", e.getAlertLevel());
            m.put("content", e.getAlertContent());
            m.put("suggestion", e.getSuggestion());
            m.put("time", e.getAlertTime().toString());
            m.put("fromDb", true);
            alerts.add(m);
        }

        return alerts;
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getOperationAdvice(Long farmlandId) throws Exception {
        Farmland f = farmlandRepo.findById(farmlandId)
                .orElseThrow(() -> new RuntimeException("地块不存在"));

        Map<String, Object> weather = fetchWeather(farmlandId);
        Map<String, Object> daily = (Map<String, Object>) weather.get("daily");
        List<String> dates = (List<String>) daily.get("time");
        List<Number> codes = (List<Number>) daily.get("weather_code");
        List<Number> highs = (List<Number>) daily.get("temperature_2m_max");
        List<Number> lows = (List<Number>) daily.get("temperature_2m_min");
        List<Number> rains = (List<Number>) daily.get("precipitation_sum");
        List<Number> winds = (List<Number>) daily.get("wind_speed_10m_max");

        List<Map<String, Object>> advice = new ArrayList<>();
        for (int i = 0; i < dates.size(); i++) {
            double rain = rains.get(i).doubleValue();
            double wind = winds.get(i).doubleValue();
            double high = highs.get(i).doubleValue();

            List<String> tasks = new ArrayList<>();
            List<String> bans = new ArrayList<>();

            if (rain < 1 && wind < 5) { tasks.add("打药"); tasks.add("施肥"); }
            else if (rain < 5) tasks.add("施肥");
            if (rain < 10) tasks.add("除草");
            if (rain < 1 && high < 30) tasks.add("采收");

            if (wind > 8) bans.add("禁打药(大风)");
            if (rain > 10) bans.add("禁施肥(有雨)");
            if (high > 35) bans.add("午间禁作业(高温)");
            if (rain > 50) { bans.add("暴雨预警"); tasks.clear(); }

            Map<String, Object> day = new LinkedHashMap<>();
            day.put("date", dates.get(i));
            day.put("weatherCode", codes.get(i).intValue());
            day.put("high", high);
            day.put("low", lows.get(i).doubleValue());
            day.put("rain", rain);
            day.put("wind", wind);
            day.put("tasks", tasks);
            day.put("bans", bans);
            advice.add(day);
        }
        return advice;
    }

    private double num(Object value, double fallback) {
        return value instanceof Number n ? n.doubleValue() : fallback;
    }

    private double numAt(List<Number> values, int index, double fallback) {
        if (values == null || index < 0 || index >= values.size()) return fallback;
        return values.get(index) != null ? values.get(index).doubleValue() : fallback;
    }

    private Map<String, Object> alert(String type, String level, String title, String suggestion) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("level", level);
        m.put("content", title);
        m.put("suggestion", suggestion);
        return m;
    }
}
