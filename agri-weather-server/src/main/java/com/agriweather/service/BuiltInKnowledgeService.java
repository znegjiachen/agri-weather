package com.agriweather.service;

import com.agriweather.entity.CropGrowthStage;
import com.agriweather.entity.CropInfo;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.CropInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 每个助农手自带的内置作物知识：由地块作物档案 + 当前生长阶段实时生成。
 *
 * 不落表，作物或种植日期一变，下一轮对话就会用新内容。
 */
@Service
@RequiredArgsConstructor
public class BuiltInKnowledgeService {

    private static final int MAX_CHARS = 1200;

    private final CropInfoRepository cropInfoRepository;
    private final CropService cropService;

    public String build(Farmland field) {
        if (field == null || field.getCropId() == null) {
            return "本地块尚未设置作物，无法生成作物档案。";
        }
        CropInfo crop = cropInfoRepository.findById(field.getCropId()).orElse(null);
        if (crop == null) {
            return "本地块绑定的作物不存在，请在作物库中重新选择。";
        }

        List<String> lines = new ArrayList<>();
        lines.add("作物：" + crop.getCropName() + (crop.getVariety() != null ? "（" + crop.getVariety() + "）" : ""));
        if (crop.getGrowthCycleDays() != null) {
            lines.add("生长周期：约 " + crop.getGrowthCycleDays() + " 天");
        }

        List<String> ranges = new ArrayList<>();
        if (crop.getSuitableTempMin() != null && crop.getSuitableTempMax() != null) {
            ranges.add("温度 " + num(crop.getSuitableTempMin()) + "–" + num(crop.getSuitableTempMax()) + "°C");
        }
        if (crop.getSuitableHumidityMin() != null && crop.getSuitableHumidityMax() != null) {
            ranges.add("湿度 " + num(crop.getSuitableHumidityMin()) + "–" + num(crop.getSuitableHumidityMax()) + "%");
        }
        if (crop.getSuitableRainfall() != null) {
            ranges.add("全周期降水约 " + num(crop.getSuitableRainfall()) + " mm");
        }
        if (!ranges.isEmpty()) {
            lines.add("适宜条件：" + String.join("；", ranges));
        }

        List<String> risks = new ArrayList<>();
        if (Boolean.TRUE.equals(crop.getFrostSensitive())) risks.add("怕霜冻");
        if (Boolean.TRUE.equals(crop.getHeatSensitive())) risks.add("怕高温");
        if (Boolean.TRUE.equals(crop.getWaterlogSensitive())) risks.add("怕涝");
        if (!risks.isEmpty()) {
            lines.add("风险敏感：" + String.join("、", risks));
        }

        if (field.getPlantDate() == null) {
            lines.add("尚未记录播种日期，无法判断当前生长阶段。");
        } else {
            CropGrowthStage stage = cropService.getCurrentStage(crop.getId(), field.getPlantDate());
            if (stage != null) {
                StringBuilder stageLine = new StringBuilder("当前阶段：").append(stage.getStageName());
                List<String> stageRanges = new ArrayList<>();
                if (stage.getTempMin() != null && stage.getTempMax() != null) {
                    stageRanges.add("适宜温度 " + num(stage.getTempMin()) + "–" + num(stage.getTempMax()) + "°C");
                }
                if (stage.getHumidityMin() != null && stage.getHumidityMax() != null) {
                    stageRanges.add("适宜湿度 " + num(stage.getHumidityMin()) + "–" + num(stage.getHumidityMax()) + "%");
                }
                if (!stageRanges.isEmpty()) {
                    stageLine.append("（").append(String.join("，", stageRanges)).append("）");
                }
                lines.add(stageLine.toString());
                if (stage.getKeyWarnings() != null && !stage.getKeyWarnings().isBlank()) {
                    lines.add("阶段提醒：" + stage.getKeyWarnings());
                }
            }
        }

        String text = String.join("\n", lines);
        return text.length() > MAX_CHARS ? text.substring(0, MAX_CHARS) + "…" : text;
    }

    private String num(Double value) {
        return value != null && value == Math.rint(value) ? String.valueOf(value.intValue()) : String.valueOf(value);
    }
}