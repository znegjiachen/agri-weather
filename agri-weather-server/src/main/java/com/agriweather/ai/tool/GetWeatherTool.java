package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolArgs;
import com.agriweather.ai.AgriContext;
import com.agriweather.service.FarmlandWeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class GetWeatherTool implements Tool {

    private final FarmlandAccessGuard guard;
    private final FarmlandWeatherService weatherService;

    @Override
    public String name() {
        return "get_weather";
    }

    @Override
    public String description() {
        return "查询指定地块的实时天气和未来7天预报（温度、降水、风速、天气状况）。"
                + "任何涉及天气的农事问题都应先调用此工具获取真实数据。";
    }

    @Override
    public Map<String, Object> parameters() {
        return Map.of("farmlandId", Map.of(
                "type", "integer",
                "description", "地块ID，可通过 list_farmlands 获得"));
    }

    /** 天气原始响应体积很大，压缩成模型易读的精简结构，省 token */
    @Override
    @SuppressWarnings("unchecked")
    public Object execute(AgentContext<?> context, Map<String, Object> args) throws Exception {
        Long farmlandId = ToolArgs.argLong(args, "farmlandId");
        AgriContext ctx = context.payload(AgriContext.class);
        guard.requireOwned(farmlandId, ctx);

        Map<String, Object> raw = weatherService.fetchWeather(farmlandId);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("farmlandName", raw.get("farmlandName"));
        if (raw.get("cropName") != null) out.put("crop", raw.get("cropName"));

        Map<String, Object> current = (Map<String, Object>) raw.get("current");
        if (current != null) {
            Map<String, Object> cur = new LinkedHashMap<>();
            cur.put("temperature", num(current.get("temperature_2m")) + "°C");
            cur.put("humidity", num(current.get("relative_humidity_2m")) + "%");
            cur.put("windSpeed", num(current.get("wind_speed_10m")) + "km/h");
            cur.put("condition", WeatherCodes.text(intVal(current.get("weather_code"))));
            out.put("current", cur);
        }

        Map<String, Object> daily = (Map<String, Object>) raw.get("daily");
        if (daily != null) {
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
                d.put("condition", WeatherCodes.text(codes.get(i).intValue()));
                d.put("tempMax", highs.get(i).doubleValue() + "°C");
                d.put("tempMin", lows.get(i).doubleValue() + "°C");
                d.put("rainfall", rains.get(i).doubleValue() + "mm");
                d.put("windSpeedMax", winds.get(i).doubleValue() + "km/h");
                forecast.add(d);
            }
            out.put("forecast7d", forecast);
        }
        out.put("dataSource", "open-meteo.com");
        return out;
    }

    private static String num(Object v) {
        if (v == null) return "?";
        double d = ((Number) v).doubleValue();
        return String.valueOf(Math.round(d * 10) / 10.0);
    }

    private static Integer intVal(Object v) {
        return v == null ? null : ((Number) v).intValue();
    }
}
