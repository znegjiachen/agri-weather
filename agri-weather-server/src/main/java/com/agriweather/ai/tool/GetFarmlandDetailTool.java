package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolArgs;
import com.agriweather.ai.AgriContext;
import com.agriweather.entity.CropInfo;
import com.agriweather.entity.Farmland;
import com.agriweather.service.CropService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GetFarmlandDetailTool implements Tool {

    private final FarmlandAccessGuard guard;
    private final CropService cropService;

    @Override
    public String name() {
        return "get_farmland_detail";
    }

    @Override
    public String description() {
        return "查询指定地块的详细信息：面积、经纬度、土壤类型、灌溉方式、所种作物、种植日期。";
    }

    @Override
    public Map<String, Object> parameters() {
        return Map.of("farmlandId", Map.of(
                "type", "integer",
                "description", "地块ID，可通过 list_farmlands 获得"));
    }

    @Override
    public Object execute(AgentContext<?> context, Map<String, Object> args) {
        Long farmlandId = ToolArgs.argLong(args, "farmlandId");
        Long userId = context.payload(AgriContext.class).userId();
        Farmland f = guard.requireOwned(farmlandId, userId);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("farmlandId", f.getId());
        m.put("name", f.getFieldName());
        m.put("areaMu", f.getAreaMu());
        m.put("lat", f.getLat());
        m.put("lng", f.getLng());
        m.put("altitude", f.getAltitude());
        m.put("soilType", f.getSoilType());
        m.put("irrigationType", f.getIrrigationType());

        if (f.getCropId() != null) {
            CropInfo crop = cropService.getById(f.getCropId());
            m.put("crop", crop.getCropName());
            m.put("variety", crop.getVariety());
            m.put("suitableTemp", crop.getSuitableTempMin() + "°C ~ " + crop.getSuitableTempMax() + "°C");
            m.put("suitableHumidity", crop.getSuitableHumidityMin() + "% ~ " + crop.getSuitableHumidityMax() + "%");
            m.put("frostSensitive", crop.getFrostSensitive());
            m.put("heatSensitive", crop.getHeatSensitive());
            m.put("waterlogSensitive", crop.getWaterlogSensitive());
        }
        m.put("plantDate", f.getPlantDate() != null ? f.getPlantDate().toString() : null);
        if (f.getCropId() == null) {
            m.put("notice", "该地块尚未设置作物和种植日期，部分分析无法进行");
        }
        return m;
    }
}
