package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolArgs;
import com.agriweather.ai.AgriContext;
import com.agriweather.service.FarmlandWeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class CheckAlertsTool implements Tool {

    private final FarmlandAccessGuard guard;
    private final FarmlandWeatherService weatherService;

    @Override
    public String name() {
        return "check_alerts";
    }

    @Override
    public String description() {
        return "对指定地块执行一次灾害预警检查，返回冻害、热害、涝害、大风、病虫害等风险预警。"
                + "当用户关心灾害风险或是否需要防范时调用。";
    }

    @Override
    public Map<String, Object> parameters() {
        return Map.of("farmlandId", Map.of(
                "type", "integer",
                "description", "地块ID，可通过 list_farmlands 获得"));
    }

    @Override
    public Object execute(AgentContext<?> context, Map<String, Object> args) throws Exception {
        Long farmlandId = ToolArgs.argLong(args, "farmlandId");
        Long userId = context.payload(AgriContext.class).userId();
        guard.requireOwned(farmlandId, userId);

        List<Map<String, Object>> alerts = weatherService.checkAlerts(farmlandId);
        if (alerts.isEmpty()) {
            return List.of(Map.of("message", "当前无预警信息"));
        }
        return alerts;
    }
}
