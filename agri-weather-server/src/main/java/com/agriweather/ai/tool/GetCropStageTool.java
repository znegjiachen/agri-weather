package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolArgs;
import com.agriweather.ai.AgriContext;
import com.agriweather.entity.CropGrowthStage;
import com.agriweather.entity.CropInfo;
import com.agriweather.entity.Farmland;
import com.agriweather.service.CropService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GetCropStageTool implements Tool {

    private final FarmlandAccessGuard guard;
    private final CropService cropService;

    @Override
    public String name() {
        return "get_crop_stage";
    }

    @Override
    public String description() {
        return "查询指定地块作物当前的生长阶段（如苗期、开花期、成熟期），"
                + "以及该阶段的适宜温度区间和已种植天数。";
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

        if (f.getCropId() == null || f.getPlantDate() == null) {
            return Map.of("error", "该地块尚未设置作物或种植日期，无法判断生长阶段");
        }
        CropGrowthStage stage = cropService.getCurrentStage(f.getCropId(), f.getPlantDate());
        if (stage == null) {
            return Map.of("error", "未找到该作物的生长阶段配置数据");
        }

        CropInfo crop = cropService.getById(f.getCropId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("crop", crop.getCropName());
        m.put("variety", crop.getVariety());
        m.put("currentStage", stage.getStageName());
        m.put("stageOrder", stage.getStageOrder());
        m.put("stageDurationDays", stage.getStageDays());
        m.put("suitableTemp", stage.getTempMin() + "°C ~ " + stage.getTempMax() + "°C");
        m.put("suitableHumidity", stage.getHumidityMin() + "% ~ " + stage.getHumidityMax() + "%");
        m.put("plantDate", f.getPlantDate().toString());
        m.put("daysSincePlant", ChronoUnit.DAYS.between(f.getPlantDate(), java.time.LocalDate.now()));
        return m;
    }
}
