package com.agriweather.service;

import com.agriweather.dto.AlertResult;
import com.agriweather.entity.*;
import com.agriweather.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 智能预警引擎 — 核心业务逻辑
 * 根据实时气象 + 作物阶段 + 地块信息 → 生成分级预警
 */
@Service
@RequiredArgsConstructor
public class AlertService {

    private final FarmlandRepository farmlandRepository;
    private final CropService cropService;
    private final PestKnowledgeRepository pestKnowledgeRepository;
    private final WeatherAlertRepository alertRepository;

    /**
     * 对指定地块做全量预警检查
     */
    public List<AlertResult> checkFarmland(Long farmlandId, double temp, double humidity,
                                            double rainfall, double windSpeed, int consecutiveRainDays) {
        Farmland farmland = farmlandRepository.findById(farmlandId)
                .orElseThrow(() -> new RuntimeException("地块不存在"));

        List<AlertResult> results = new ArrayList<>();

        if (farmland.getCropId() == null || farmland.getPlantDate() == null) {
            results.add(AlertResult.builder().alertType("INFO").alertLevel("BLUE")
                    .alertContent("请先设置地块的作物和种植日期").build());
            return results;
        }

        CropGrowthStage stage = cropService.getCurrentStage(farmland.getCropId(), farmland.getPlantDate());
        if (stage == null) {
            results.add(AlertResult.builder().alertType("INFO").alertLevel("BLUE")
                    .alertContent("未找到作物生长阶段数据").build());
            return results;
        }

        // 1. 温度预警
        checkTemperatureAlert(results, stage, temp);

        // 2. 湿度预警
        checkHumidityAlert(results, stage, humidity);

        // 3. 降水预警
        checkRainfallAlert(results, stage, rainfall, consecutiveRainDays);

        // 4. 大风预警
        if (windSpeed > 8) {
            results.add(AlertResult.builder()
                    .alertType("WIND").alertLevel("YELLOW").triggered(true)
                    .alertContent("风速 " + windSpeed + " m/s，超过安全阈值")
                    .suggestion("大风天气，禁止喷药施肥；检查大棚加固；暂停田间高空作业")
                    .build());
        }

        // 5. 冻害预警
        if (temp < 5 && (stage.getStageName().contains("苗") || stage.getStageName().contains("花"))) {
            results.add(AlertResult.builder()
                    .alertType("FROST").alertLevel(temp < 0 ? "RED" : "ORANGE").triggered(true)
                    .alertContent("温度 " + temp + "°C，当前" + stage.getStageName() + "期，有冻害风险")
                    .suggestion("立即覆膜保温；夜间熏烟防霜；已受冻地块喷施叶面肥恢复")
                    .build());
        }

        // 6. 高温热害预警
        if (temp > 35) {
            results.add(AlertResult.builder()
                    .alertType("HEAT").alertLevel(temp > 40 ? "RED" : "ORANGE").triggered(true)
                    .alertContent("高温 " + temp + "°C，当前" + stage.getStageName() + "期，有热害风险")
                    .suggestion("增加灌溉频次；11:00-15:00 暂停田间作业；覆盖遮阳网降温")
                    .build());
        }

        // 7. 病虫害预警
        checkPestAlert(results, stage, temp, humidity, consecutiveRainDays);

        // 保存预警到数据库
        for (AlertResult r : results) {
            if (r.isTriggered()) {
                WeatherAlert alert = WeatherAlert.builder()
                        .userId(farmland.getUserId())
                        .farmlandId(farmlandId)
                        .alertType(r.getAlertType())
                        .alertLevel(r.getAlertLevel())
                        .alertContent(r.getAlertContent())
                        .suggestion(r.getSuggestion())
                        .build();
                alertRepository.save(alert);
            }
        }

        if (results.stream().noneMatch(AlertResult::isTriggered)) {
            results.add(AlertResult.builder()
                    .alertType("NORMAL").alertLevel("GREEN").triggered(false)
                    .alertContent("当前气象条件适宜，无异常预警")
                    .build());
        }

        return results;
    }

    private void checkTemperatureAlert(List<AlertResult> results, CropGrowthStage stage, double temp) {
        if (stage.getTempMin() != null && temp < stage.getTempMin()) {
            double diff = stage.getTempMin() - temp;
            String level = diff > 5 ? "ORANGE" : "YELLOW";
            results.add(AlertResult.builder().alertType("TEMP_LOW").alertLevel(level).triggered(true)
                    .alertContent("温度偏低 " + temp + "°C（适宜 ≥" + stage.getTempMin() + "°C）")
                    .suggestion("覆膜保温，适当增温")
                    .build());
        }
        if (stage.getTempMax() != null && temp > stage.getTempMax()) {
            double diff = temp - stage.getTempMax();
            String level = diff > 5 ? "ORANGE" : "YELLOW";
            results.add(AlertResult.builder().alertType("TEMP_HIGH").alertLevel(level).triggered(true)
                    .alertContent("温度偏高 " + temp + "°C（适宜 ≤" + stage.getTempMax() + "°C）")
                    .suggestion("加强通风，遮阳降温")
                    .build());
        }
    }

    private void checkHumidityAlert(List<AlertResult> results, CropGrowthStage stage, double humidity) {
        if (stage.getHumidityMin() != null && humidity < stage.getHumidityMin()) {
            results.add(AlertResult.builder().alertType("HUMIDITY_LOW").alertLevel("YELLOW").triggered(true)
                    .alertContent("湿度偏低 " + humidity + "%（适宜 ≥" + stage.getHumidityMin() + "%）")
                    .suggestion("适时灌溉补水")
                    .build());
        }
        if (stage.getHumidityMax() != null && humidity > stage.getHumidityMax()) {
            results.add(AlertResult.builder().alertType("HUMIDITY_HIGH").alertLevel("YELLOW").triggered(true)
                    .alertContent("湿度过高 " + humidity + "%（适宜 ≤" + stage.getHumidityMax() + "%）")
                    .suggestion("注意通风排湿，预防病害")
                    .build());
        }
    }

    private void checkRainfallAlert(List<AlertResult> results, CropGrowthStage stage,
                                     double rainfall, int consecutiveRainDays) {
        if (consecutiveRainDays >= 5) {
            results.add(AlertResult.builder().alertType("RAIN_CONTINUOUS").alertLevel("ORANGE").triggered(true)
                    .alertContent("已连续降雨 " + consecutiveRainDays + " 天，有涝害和病害风险")
                    .suggestion("疏通沟渠排水；雨后及时打药防病")
                    .build());
        }
        if (rainfall > 50) {
            results.add(AlertResult.builder().alertType("RAINSTORM").alertLevel("RED").triggered(true)
                    .alertContent("暴雨预警：降水量 " + rainfall + "mm")
                    .suggestion("停止田间作业；检查排水系统；大棚加固")
                    .build());
        }
    }

    private void checkPestAlert(List<AlertResult> results, CropGrowthStage stage,
                                 double temp, double humidity, int consecutiveRainDays) {
        List<PestKnowledge> pests = pestKnowledgeRepository.findAll();

        for (PestKnowledge pest : pests) {
            boolean tempMatch = (pest.getTriggerTempMin() == null || temp >= pest.getTriggerTempMin())
                    && (pest.getTriggerTempMax() == null || temp <= pest.getTriggerTempMax());
            boolean humidityMatch = (pest.getTriggerHumidityMin() == null || humidity >= pest.getTriggerHumidityMin())
                    && (pest.getTriggerHumidityMax() == null || humidity <= pest.getTriggerHumidityMax());
            boolean rainMatch = pest.getTriggerRainDays() == null || consecutiveRainDays >= pest.getTriggerRainDays();

            if (tempMatch && humidityMatch && rainMatch) {
                results.add(AlertResult.builder()
                        .alertType("PEST").alertLevel("YELLOW").triggered(true)
                        .alertContent("气象条件适宜「" + pest.getPestName() + "」发生，请注意防范")
                        .suggestion("预防：" + pest.getPrevention() + "；治疗：" + pest.getControlMethod())
                        .build());
            }
        }
    }

    public List<WeatherAlert> getUserAlerts(Long userId) {
        List<WeatherAlert> alerts = alertRepository.findByUserIdOrderByAlertTimeDesc(userId);
        if (alerts.isEmpty()) return alerts;

        // 批量补地块/作物名，避免每条预警都查一次库
        List<Long> farmlandIds = alerts.stream()
                .map(WeatherAlert::getFarmlandId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Farmland> farmlandMap = farmlandRepository.findAllById(farmlandIds).stream()
                .collect(java.util.stream.Collectors.toMap(Farmland::getId, f -> f));
        Map<Long, String> cropNames = new java.util.HashMap<>();
        for (CropInfo crop : cropService.listAll()) {
            cropNames.put(crop.getId(), crop.getCropName());
        }
        for (WeatherAlert a : alerts) {
            Farmland f = farmlandMap.get(a.getFarmlandId());
            if (f != null) {
                a.setFarmlandName(f.getFieldName());
                if (f.getCropId() != null) a.setCropName(cropNames.get(f.getCropId()));
            }
        }
        return alerts;
    }

    public long getUnreadCount(Long userId) {
        return alertRepository.countByUserIdAndIsReadFalse(userId);
    }

    /** 标记已处理：同时视为已读，便于前端区分「看过」和「处理完」 */
    public void markHandled(Long id, Long userId) {
        WeatherAlert alert = alertRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("预警不存在"));
        if (!Objects.equals(alert.getUserId(), userId)) {
            throw new SecurityException("无权操作该预警");
        }
        alert.setIsHandled(true);
        alert.setIsRead(true);
        alertRepository.save(alert);
    }

    /** 只能标记自己的预警，否则抛 SecurityException（由全局处理器转 403） */
    public void markAsRead(Long id, Long userId) {
        WeatherAlert alert = alertRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("预警不存在"));
        if (!Objects.equals(alert.getUserId(), userId)) {
            throw new SecurityException("无权操作该预警");
        }
        alert.setIsRead(true);
        alertRepository.save(alert);
    }

    public void markAllAsRead(Long userId) {
        List<WeatherAlert> unread = alertRepository.findByUserIdAndIsReadFalse(userId);
        for (WeatherAlert a : unread) {
            a.setIsRead(true);
            alertRepository.save(a);
        }
    }
}
