package com.agriweather.service;

import com.agriweather.entity.CropInfo;
import com.agriweather.entity.Farmland;
import com.agriweather.entity.FarmlandAgent;
import com.agriweather.repository.CropInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * 地块专属助农手的默认名称/头像/人设/欢迎语。
 *
 * 人设只写稳定的地块与作物信息，生长阶段等动态数据由内置知识每轮生成，
 * 避免人设随时间过时。
 */
@Service
@RequiredArgsConstructor
public class AgentDefaults {

    private final CropInfoRepository cropInfoRepository;

    private static final Map<String, String> AVATARS = Map.ofEntries(
            Map.entry("玉米", "🌽"),
            Map.entry("小麦", "🌾"),
            Map.entry("水稻", "🌾"),
            Map.entry("大豆", "🫘"),
            Map.entry("番茄", "🍅"),
            Map.entry("黄瓜", "🥒"),
            Map.entry("辣椒", "🌶️"),
            Map.entry("白菜", "🥬"),
            Map.entry("马铃薯", "🥔"),
            Map.entry("棉花", "🌱"),
            Map.entry("油菜", "🌼"),
            Map.entry("苹果", "🍎"),
            Map.entry("柑橘", "🍊"),
            Map.entry("葡萄", "🍇")
    );

    public CropInfo crop(Farmland field) {
        if (field == null || field.getCropId() == null) return null;
        return cropInfoRepository.findById(field.getCropId()).orElse(null);
    }

    public String defaultName(Farmland field) {
        String name = (field.getFieldName() != null ? field.getFieldName() : "地块") + "的助农手";
        return name.length() > 100 ? name.substring(0, 100) : name;
    }

    public String defaultAvatar(Farmland field) {
        CropInfo crop = crop(field);
        if (crop == null || crop.getCropName() == null) return "🌾";
        return AVATARS.getOrDefault(crop.getCropName(), "🌾");
    }

    public String defaultWelcome(Farmland field) {
        CropInfo crop = crop(field);
        String cropName = crop != null ? crop.getCropName() : "作物";
        String name = field.getFieldName() != null ? field.getFieldName() : "这块地";
        return "我是「" + name + "」的专属助农手，这块地" + cropName
                + "的天气、长势和农事安排都可以问我。";
    }

    public String defaultPersona(Farmland field) {
        CropInfo crop = crop(field);
        String fieldName = field.getFieldName() != null ? field.getFieldName() : "本地块";
        String cropName = crop != null && crop.getCropName() != null ? crop.getCropName() : "尚未设置作物";

        StringBuilder sb = new StringBuilder();
        sb.append("你是「").append(fieldName).append("」的专属助农手，负责这块地的").append(cropName).append("。");
        if (field.getAreaMu() != null) sb.append("地块面积约 ").append(trimNumber(field.getAreaMu())).append(" 亩，");
        if (field.getSoilType() != null) sb.append("土壤类型是").append(field.getSoilType()).append("，");
        if (field.getIrrigationType() != null) sb.append("灌溉方式为").append(field.getIrrigationType()).append("。");
        sb.append("\n\n");
        sb.append("工作方式：\n");
        sb.append("- 只处理与「").append(fieldName).append("」相关的农事问题；涉及其他地块时，提醒用户切换到对应地块的助农手。\n");
        sb.append("- 回答优先依据本智能体的知识库，以及平台工具查询到的该地块真实天气、生长阶段、预警和农事建议。\n");
        sb.append("- 调用工具时使用这块地的 ID，不要查询或讨论其他地块。\n");
        sb.append("- 不确定或数据缺失时如实说明；不编造农药浓度、剂量和未经验证的结论。\n");
        sb.append("- 用中文、像经验丰富的农技员一样给出具体可执行的建议。");
        return sb.toString();
    }

    public void applyDefault(FarmlandAgent agent, Farmland field) {
        agent.setUserId(field.getUserId());
        agent.setFarmlandId(field.getId());
        agent.setName(defaultName(field));
        agent.setAvatar(defaultAvatar(field));
        agent.setPersona(defaultPersona(field));
        agent.setWelcome(defaultWelcome(field));
        agent.setPersonaCustom(false);
        agent.setUpdatedAt(java.time.LocalDateTime.now());
    }

    private String trimNumber(Double value) {
        return value == Math.rint(value) ? String.valueOf(value.intValue()) : value.toString();
    }
}