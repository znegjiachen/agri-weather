package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolArgs;
import com.agriweather.ai.AgriContext;
import com.agriweather.service.FarmlandWeatherService;
import com.agriweather.service.OperationAdvisor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GetOperationAdviceTool implements Tool {

    private final FarmlandAccessGuard guard;
    private final FarmlandWeatherService weatherService;
    private final OperationAdvisor operationAdvisor;

    @Override
    public String name() {
        return "get_operation_advice";
    }

    @Override
    public String description() {
        return "调用平台的农事决策引擎，获取未来7天的农事作业建议，"
                + "包含每天适宜做什么（播种/施肥/打药/灌溉/采收）和明令禁止项。"
                + "这是平台内置的权威规则，涉及农事安排时应优先采用其结果。";
    }

    @Override
    public Map<String, Object> parameters() {
        return Map.of("farmlandId", Map.of(
                "type", "integer",
                "description", "地块ID，可通过 list_farmlands 获得"));
    }

    @Override
    @SuppressWarnings("unchecked")
    public Object execute(AgentContext<?> context, Map<String, Object> args) throws Exception {
        Long farmlandId = ToolArgs.argLong(args, "farmlandId");
        AgriContext ctx = context.payload(AgriContext.class);
        guard.requireOwned(farmlandId, ctx);

        // 取天气，转成 OperationAdvisor 需要的格式
        Map<String, Object> weather = weatherService.fetchWeather(farmlandId);
        Map<String, Object> daily = (Map<String, Object>) weather.get("daily");
        if (daily == null) {
            return Map.of("error", "无法获取天气数据，暂时无法生成农事建议");
        }

        Map<String, Object> current = (Map<String, Object>) weather.get("current");
        double humidity = current != null && current.get("relative_humidity_2m") != null
                ? ((Number) current.get("relative_humidity_2m")).doubleValue() : 60;

        List<String> dates = (List<String>) daily.get("time");
        List<Number> codes = (List<Number>) daily.get("weather_code");
        List<Number> highs = (List<Number>) daily.get("temperature_2m_max");
        List<Number> lows = (List<Number>) daily.get("temperature_2m_min");
        List<Number> rains = (List<Number>) daily.get("precipitation_sum");
        List<Number> winds = (List<Number>) daily.get("wind_speed_10m_max");

        List<Map<String, Object>> forecast = new ArrayList<>();
        for (int i = 0; i < dates.size(); i++) {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("date", dates.get(i));
            d.put("tempMax", highs.get(i).doubleValue());
            d.put("tempMin", lows.get(i).doubleValue());
            d.put("humidity", humidity);
            d.put("rainfall", rains.get(i).doubleValue());
            d.put("windSpeed", winds.get(i).doubleValue());
            d.put("condition", WeatherCodes.text(codes.get(i).intValue()));
            forecast.add(d);
        }

        return operationAdvisor.getOperationAdvice(farmlandId, forecast);
    }
}
