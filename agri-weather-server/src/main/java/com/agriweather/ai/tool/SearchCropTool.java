package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolArgs;
import com.agriweather.entity.CropInfo;
import com.agriweather.service.CropService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SearchCropTool implements Tool {

    private final CropService cropService;

    @Override
    public String name() {
        return "search_crop";
    }

    @Override
    public String description() {
        return "按名称关键词检索作物知识库，返回作物的适宜温度、湿度、降水、光照等生长参数。";
    }

    @Override
    public Map<String, Object> parameters() {
        return Map.of("keyword", Map.of(
                "type", "string",
                "description", "作物名称关键词，如「番茄」「水稻」"));
    }

    @Override
    public Object execute(AgentContext<?> context, Map<String, Object> args) {
        String keyword = ToolArgs.argStr(args, "keyword");

        if (keyword == null || keyword.isBlank()) {
            return cropService.listAll().stream().map(this::cropBrief).toList();
        }
        List<CropInfo> found = cropService.search(keyword);
        if (found.isEmpty()) {
            return List.of(Map.of("message", "知识库中没有找到作物：" + keyword));
        }
        return found.stream().map(this::cropBrief).toList();
    }

    private Map<String, Object> cropBrief(CropInfo c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("crop", c.getCropName());
        m.put("variety", c.getVariety());
        m.put("suitableTemp", c.getSuitableTempMin() + "°C ~ " + c.getSuitableTempMax() + "°C");
        m.put("suitableHumidity", c.getSuitableHumidityMin() + "% ~ " + c.getSuitableHumidityMax() + "%");
        m.put("suitableRainfall", c.getSuitableRainfall() + "mm");
        m.put("suitableLightHours", c.getSuitableLightHours() + "h");
        m.put("frostSensitive", c.getFrostSensitive());
        m.put("heatSensitive", c.getHeatSensitive());
        m.put("waterlogSensitive", c.getWaterlogSensitive());
        return m;
    }
}
