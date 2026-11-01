package com.agriweather.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 和风天气备源。
 *
 * 只在 Open-Meteo 回源失败且配置了 QWEATHER_API_KEY 时使用，
 * 并把字段转换成 Open-Meteo 的形状，避免前端和缓存感知到两套结构。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QWeatherFallbackClient {

    private final WeatherProperties props;
    private final ObjectMapper mapper;

    private volatile HttpClient http;

    public boolean isConfigured() {
        return props.getFallbackApiKey() != null && !props.getFallbackApiKey().isBlank();
    }

    public Map<String, Object> fetch(WeatherCoord coord) throws Exception {
        if (!isConfigured()) {
            throw new IllegalStateException("未配置和风天气 API Key");
        }
        String location = coord.queryLng() + "," + coord.queryLat();
        JsonNode now = get("/v7/weather/now?location=" + location);
        JsonNode daily = get("/v7/weather/7d?location=" + location);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("_source", "qweather");
        result.put("current", mapCurrent(now.path("now")));
        result.put("daily", mapDaily(daily.path("daily")));
        return result;
    }

    private JsonNode get(String path) throws Exception {
        String base = props.getFallbackBaseUrl();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        String url = base + path + "&key=" + props.getFallbackApiKey();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("和风天气返回 HTTP " + response.statusCode());
        }
        JsonNode root = mapper.readTree(response.body());
        String code = root.path("code").asText("");
        if (!"200".equals(code)) {
            throw new IllegalStateException("和风天气业务码 " + code);
        }
        return root;
    }

    private Map<String, Object> mapCurrent(JsonNode now) {
        Map<String, Object> current = new LinkedHashMap<>();
        current.put("time", text(now, "obsTime"));
        current.put("temperature_2m", number(now, "temp"));
        current.put("relative_humidity_2m", number(now, "humidity"));
        current.put("weather_code", weatherCode(now.path("icon").asInt(0), text(now, "text")));
        current.put("wind_speed_10m", number(now, "windSpeed"));
        current.put("visibility", number(now, "vis") * 1000);
        current.put("surface_pressure", number(now, "pressure"));
        return current;
    }

    private Map<String, Object> mapDaily(JsonNode days) {
        List<String> time = new ArrayList<>();
        List<Integer> codes = new ArrayList<>();
        List<Double> max = new ArrayList<>();
        List<Double> min = new ArrayList<>();
        List<Double> rain = new ArrayList<>();
        List<Double> wind = new ArrayList<>();
        List<String> sunrise = new ArrayList<>();
        List<String> sunset = new ArrayList<>();

        for (JsonNode day : days) {
            String date = day.path("fxDate").asText("");
            time.add(date);
            codes.add(weatherCode(day.path("iconDay").asInt(0), day.path("textDay").asText("")));
            max.add(day.path("tempMax").asDouble());
            min.add(day.path("tempMin").asDouble());
            rain.add(day.path("precip").asDouble());
            wind.add(day.path("windSpeedDay").asDouble());
            sunrise.add(date + "T" + day.path("sunrise").asText("06:00") + ":00");
            sunset.add(date + "T" + day.path("sunset").asText("18:00") + ":00");
        }

        Map<String, Object> daily = new LinkedHashMap<>();
        daily.put("time", time);
        daily.put("weather_code", codes);
        daily.put("temperature_2m_max", max);
        daily.put("temperature_2m_min", min);
        daily.put("precipitation_sum", rain);
        daily.put("wind_speed_10m_max", wind);
        daily.put("sunrise", sunrise);
        daily.put("sunset", sunset);
        return daily;
    }

    /** 把和风 icon / 文本粗映射到 Open-Meteo weather_code */
    private int weatherCode(int icon, String text) {
        if (icon >= 100 && icon < 200) {
            return icon == 100 ? 0 : icon == 104 ? 3 : 2;
        }
        if (icon >= 300 && icon < 400) {
            if (icon == 302 || icon == 303) return 95;
            if (icon == 304) return 63;
            if (icon >= 313 || icon == 300) return 61;
            return 80;
        }
        if (icon >= 400 && icon < 500) {
            return icon >= 404 ? 73 : 71;
        }
        if (icon >= 500 && icon < 600) {
            return 45;
        }
        String value = text == null ? "" : text;
        if (value.contains("雷")) return 95;
        if (value.contains("暴雨")) return 65;
        if (value.contains("大雨")) return 63;
        if (value.contains("雨")) return 61;
        if (value.contains("雪")) return 71;
        if (value.contains("雾") || value.contains("霾")) return 45;
        if (value.contains("阴")) return 3;
        if (value.contains("云")) return 2;
        return 0;
    }

    private String text(JsonNode node, String field) {
        String value = node.path(field).asText("");
        return value.isBlank() ? null : value;
    }

    private double number(JsonNode node, String field) {
        return node.path(field).asDouble();
    }

    private HttpClient client() {
        HttpClient current = http;
        if (current == null) {
            synchronized (this) {
                if (http == null) {
                    http = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofMillis(props.getConnectTimeoutMs()))
                            .followRedirects(HttpClient.Redirect.NORMAL)
                            .build();
                }
                current = http;
            }
        }
        return current;
    }
}