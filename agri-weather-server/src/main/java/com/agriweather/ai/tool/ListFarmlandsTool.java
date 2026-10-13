package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.ai.AgriContext;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.service.CropService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class ListFarmlandsTool implements Tool {

    private final FarmlandRepository farmlandRepo;
    private final CropService cropService;

    @Override
    public String name() {
        return "list_farmlands";
    }

    @Override
    public String description() {
        return "列出当前用户的所有地块，返回地块ID、名称、作物、种植日期。"
                + "当用户没有指明具体地块，或你需要先知道有哪些地块时，先调用这个工具。";
    }

    @Override
    public Map<String, Object> parameters() {
        return Map.of();
    }

    @Override
    public Object execute(AgentContext<?> context, Map<String, Object> args) {
        Long userId = context.payload(AgriContext.class).userId();

        List<Map<String, Object>> out = new ArrayList<>();
        for (Farmland f : farmlandRepo.findByUserId(userId)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("farmlandId", f.getId());
            m.put("name", f.getFieldName());
            m.put("areaMu", f.getAreaMu());
            m.put("soilType", f.getSoilType());
            if (f.getCropId() != null) {
                cropService.listAll().stream()
                        .filter(c -> c.getId().equals(f.getCropId()))
                        .findFirst()
                        .ifPresent(c -> m.put("crop", c.getCropName()));
            }
            m.put("plantDate", f.getPlantDate() != null ? f.getPlantDate().toString() : null);
            out.add(m);
        }
        if (out.isEmpty()) {
            return List.of(Map.of("message", "当前用户还没有添加任何地块"));
        }
        return out;
    }
}
