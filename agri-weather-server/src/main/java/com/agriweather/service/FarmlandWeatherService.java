package com.agriweather.service;

import com.agriweather.entity.*;
import com.agriweather.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FarmlandWeatherService {

    private final FarmlandRepository farmlandRepo;
    private final CropInfoRepository cropRepo;
    private final CropGrowthStageRepository stageRepo;
    private final WeatherAlertRepository alertRepo;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @SuppressWarnings("unchecked")
    public Map<String, Object> fetchWeather(Long farmlandId) throws Exception {
        Farmland f = farmlandRepo.findById(farmlandId)
                .orElseThrow(() -> new RuntimeException("地块不存在"));

        String url = String.format(
            "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f" +
            "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility,surface_pressure" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
            "&timezone=auto&forecast_days=7",
            f.getLat(), f.getLng());

        HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url)).GET().build();
        HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        Map<String, Object> data = mapper.readValue(res.body(), Map.class);

        data.put("farmlandName", f.getFieldName());
        data.put("farmlandId", f.getId());
        if (f.getCropId() != null) {
            cropRepo.findById(f.getCropId()).ifPresent(c -> {
                data.put("cropName", c.getCropName());
                data.put("cropId", c.getId());
            });
        }
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
                acc += s.getStageDays();
                if (daysSincePlant <= acc) { currentStage = s; break; }
            }
            if (currentStage == null) currentStage = stages.get(stages.size() - 1);
        }

        // 获取实时天气
        Map<String, Object> weather = fetchWeather(farmlandId);
        Map<String, Object> current = (Map<String, Object>) weather.get("current");
        double temp = ((Number) current.get("temperature_2m")).doubleValue();
        double humidity = ((Number) current.get("relative_humidity_2m")).doubleValue();
        double windSpeed = ((Number) current.get("wind_speed_10m")).doubleValue();

        List<Map<String, Object>> alerts = new ArrayList<>();

        Map<String, Object> daily = (Map<String, Object>) weather.get("daily");
        List<Number> precipList = (List<Number>) daily.get("precipitation_sum");
        double todayRain = precipList.get(0).doubleValue();

        // 温度预警
        if (crop.getFrostSensitive() && temp < 5) {
            alerts.add(alert("FROST", "RED", "低温冻害预警",
                String.format("%s当前温度%.1f°C，低于5°C，存在冻害风险！建议覆盖薄膜、熏烟增温。", f.getFieldName(), temp)));
        }
        if (crop.getHeatSensitive() && temp > 35) {
            alerts.add(alert("HEAT", "ORANGE", "高温热害预警",
                String.format("%s当前温度%.1f°C，超过35°C，%s怕热！建议遮阳降温、增加灌溉。", f.getFieldName(), temp, crop.getCropName())));
        }
        if (crop.getWaterlogSensitive() && todayRain > 50) {
            alerts.add(alert("RAINSTORM", "YELLOW", "暴雨涝害预警",
                String.format("%s今日降水%.0fmm，%s怕涝！建议疏通沟渠、及时排水。", f.getFieldName(), todayRain, crop.getCropName())));
        }

        // 生长阶段专项预警
        if (currentStage != null) {
            if (temp > currentStage.getTempMax()) {
                alerts.add(alert("HEAT", "ORANGE", "阶段高温预警",
                    String.format("%s处于%s，适宜温度≤%.0f°C，当前%.1f°C超标！", crop.getCropName(), currentStage.getStageName(), currentStage.getTempMax(), temp)));
            }
            if (temp < currentStage.getTempMin()) {
                alerts.add(alert("FROST", "RED", "阶段低温预警",
                    String.format("%s处于%s，适宜温度≥%.0f°C，当前%.1f°C偏低！", crop.getCropName(), currentStage.getStageName(), currentStage.getTempMin(), temp)));
            }
        }

        if (windSpeed > 8) {
            alerts.add(alert("WIND", "YELLOW", "大风作业预警",
                String.format("当前风速%.1f km/h，不建议打药施肥。", windSpeed)));
        }

        // 去重保存：今天同类型同地块不重复插入
        LocalDate today = LocalDate.now();
        for (Map<String, Object> a : alerts) {
            String alertType = (String) a.get("type");
            boolean exists = alertRepo.findByFarmlandIdOrderByAlertTimeDesc(f.getId())
                .stream()
                .anyMatch(ex -> ex.getAlertType().equals(alertType)
                    && ex.getAlertTime().toLocalDate().equals(today));
            if (!exists) {
                WeatherAlert wa = WeatherAlert.builder()
                    .userId(f.getUserId()).farmlandId(f.getId())
                    .alertType(alertType)
                    .alertLevel((String) a.get("level"))
                    .alertContent((String) a.get("content"))
                    .suggestion((String) a.get("suggestion"))
                    .alertTime(LocalDateTime.now())
                    .build();
                alertRepo.save(wa);
            }
        }

        // 同时返回已有预警
        List<WeatherAlert> existing = alertRepo.findByFarmlandIdOrderByAlertTimeDesc(f.getId());
        for (WeatherAlert e : existing) {
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

    private Map<String, Object> alert(String type, String level, String title, String suggestion) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("level", level);
        m.put("content", title);
        m.put("suggestion", suggestion);
        return m;
    }
}
