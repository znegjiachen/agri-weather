package com.agriweather.ai;

import com.agriweather.entity.CropGrowthStage;
import com.agriweather.entity.CropInfo;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.service.CropService;
import com.agriweather.service.FarmlandWeatherService;
import com.agriweather.service.OperationAdvisor;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 农事工具注册表
 *
 * 把平台已有的业务能力（天气查询、作物阶段、规则引擎）包装成模型可调用的工具。
 * 模型负责「决定查什么」，业务代码负责「怎么算」—— 农学判断始终走确定性规则，
 * 不由模型自由发挥。
 *
 * 所有涉及地块的工具都会校验归属，防止越权访问他人地块。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AgriToolRegistry {

    private final FarmlandRepository farmlandRepo;
    private final FarmlandWeatherService weatherService;
    private final CropService cropService;
    private final OperationAdvisor operationAdvisor;
    private final ObjectMapper mapper;

    // ============================================================ 工具定义

    /** 返回 OpenAI 协议格式的工具描述列表 */
    public List<Map<String, Object>> toolSchemas() {
        List<Map<String, Object>> tools = new ArrayList<>();

        tools.add(tool("list_farmlands",
                "列出当前用户的所有地块，返回地块ID、名称、作物、种植日期。"
                        + "当用户没有指明具体地块，或你需要先知道有哪些地块时，先调用这个工具。",
                Map.of()));

        tools.add(tool("get_farmland_detail",
                "查询指定地块的详细信息：面积、经纬度、土壤类型、灌溉方式、所种作物、种植日期。",
                Map.of("farmlandId", Map.of(
                        "type", "integer",
                        "description", "地块ID，可通过 list_farmlands 获得"))));

        tools.add(tool("get_weather",
                "查询指定地块的实时天气和未来7天预报（温度、降水、风速、天气状况）。"
                        + "任何涉及天气的农事问题都应先调用此工具获取真实数据。",
                Map.of("farmlandId", Map.of(
                        "type", "integer",
                        "description", "地块ID，可通过 list_farmlands 获得"))));

        tools.add(tool("get_crop_stage",
                "查询指定地块作物当前的生长阶段（如苗期、开花期、成熟期），"
                        + "以及该阶段的适宜温度区间和已种植天数。",
                Map.of("farmlandId", Map.of(
                        "type", "integer",
                        "description", "地块ID，可通过 list_farmlands 获得"))));

        tools.add(tool("get_operation_advice",
                "调用平台的农事决策引擎，获取未来7天的农事作业建议，"
                        + "包含每天适宜做什么（播种/施肥/打药/灌溉/采收）和明令禁止项。"
                        + "这是平台内置的权威规则，涉及农事安排时应优先采用其结果。",
                Map.of("farmlandId", Map.of(
                        "type", "integer",
                        "description", "地块ID，可通过 list_farmlands 获得"))));

        tools.add(tool("check_alerts",
                "对指定地块执行一次灾害预警检查，返回冻害、热害、涝害、大风、病虫害等风险预警。"
                        + "当用户关心灾害风险或是否需要防范时调用。",
                Map.of("farmlandId", Map.of(
                        "type", "integer",
                        "description", "地块ID，可通过 list_farmlands 获得"))));

        tools.add(tool("search_crop",
                "按名称关键词检索作物知识库，返回作物的适宜温度、湿度、降水、光照等生长参数。",
                Map.of("keyword", Map.of(
                        "type", "string",
                        "description", "作物名称关键词，如「番茄」「水稻」"))));

        return tools;
    }

    private Map<String, Object> tool(String name, String description, Map<String, Object> properties) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("type", "object");
        params.put("properties", properties);
        params.put("required", new ArrayList<>(properties.keySet()));

        Map<String, Object> function = new LinkedHashMap<>();
        function.put("name", name);
        function.put("description", description);
        function.put("parameters", params);

        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("type", "function");
        wrapper.put("function", function);
        return wrapper;
    }

    // ============================================================ 工具执行

    /**
     * 执行工具调用。
     *
     * 任何异常都被转成 JSON 错误对象返回给模型 —— 而不是抛出中断整个对话。
     * 这样模型能看到「这个工具失败了、原因是什么」，从而自行换一个思路。
     */
    public String execute(String name, String argsJson, Long userId) {
        try {
            Map<String, Object> args = parseArgs(argsJson);
            Object result = switch (name) {
                case "list_farmlands" -> listFarmlands(userId);
                case "get_farmland_detail" -> getFarmlandDetail(argLong(args, "farmlandId"), userId);
                case "get_weather" -> getWeather(argLong(args, "farmlandId"), userId);
                case "get_crop_stage" -> getCropStage(argLong(args, "farmlandId"), userId);
                case "get_operation_advice" -> getOperationAdvice(argLong(args, "farmlandId"), userId);
                case "check_alerts" -> checkAlerts(argLong(args, "farmlandId"), userId);
                case "search_crop" -> searchCrop(argStr(args, "keyword"));
                default -> Map.of("error", "未知工具：" + name);
            };
            return mapper.writeValueAsString(result);
        } catch (Exception e) {
            log.warn("工具 {} 执行失败: {}", name, e.getMessage());
            try {
                return mapper.writeValueAsString(Map.of("error", String.valueOf(e.getMessage())));
            } catch (Exception ignored) {
                return "{\"error\":\"工具执行失败\"}";
            }
        }
    }

    // ---------------------------------------------------------- 各工具实现

    private List<Map<String, Object>> listFarmlands(Long userId) {
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

    private Map<String, Object> getFarmlandDetail(Long farmlandId, Long userId) {
        Farmland f = requireOwned(farmlandId, userId);
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

    /** 天气原始响应体积很大，压缩成模型易读的精简结构，省 token */
    @SuppressWarnings("unchecked")
    private Map<String, Object> getWeather(Long farmlandId, Long userId) throws Exception {
        requireOwned(farmlandId, userId);
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
            cur.put("condition", weatherText(intVal(current.get("weather_code"))));
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
                d.put("condition", weatherText(codes.get(i).intValue()));
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

    private Map<String, Object> getCropStage(Long farmlandId, Long userId) {
        Farmland f = requireOwned(farmlandId, userId);
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
        m.put("daysSincePlant",
                java.time.temporal.ChronoUnit.DAYS.between(f.getPlantDate(), java.time.LocalDate.now()));
        return m;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getOperationAdvice(Long farmlandId, Long userId) throws Exception {
        requireOwned(farmlandId, userId);

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
            d.put("condition", weatherText(codes.get(i).intValue()));
            forecast.add(d);
        }

        return operationAdvisor.getOperationAdvice(farmlandId, forecast);
    }

    private List<Map<String, Object>> checkAlerts(Long farmlandId, Long userId) throws Exception {
        requireOwned(farmlandId, userId);
        List<Map<String, Object>> alerts = weatherService.checkAlerts(farmlandId);
        if (alerts.isEmpty()) {
            return List.of(Map.of("message", "当前无预警信息"));
        }
        return alerts;
    }

    private List<Map<String, Object>> searchCrop(String keyword) {
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

    // ============================================================ 辅助

    /** 校验地块存在且属于该用户 —— 防止越权查询他人地块 */
    private Farmland requireOwned(Long farmlandId, Long userId) {
        Farmland f = farmlandRepo.findById(farmlandId)
                .orElseThrow(() -> new IllegalArgumentException("地块不存在（ID=" + farmlandId + "）"));
        if (!Objects.equals(f.getUserId(), userId)) {
            throw new IllegalArgumentException("无权访问该地块（ID=" + farmlandId + "）");
        }
        return f;
    }

    private Map<String, Object> parseArgs(String json) throws Exception {
        if (json == null || json.isBlank()) return Map.of();
        return mapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    }

    private Long argLong(Map<String, Object> args, String key) {
        Object v = args.get(key);
        if (v == null) throw new IllegalArgumentException("缺少参数：" + key);
        if (v instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(v.toString().trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("参数 " + key + " 必须是整数，收到：" + v);
        }
    }

    private String argStr(Map<String, Object> args, String key) {
        Object v = args.get(key);
        return v == null ? null : v.toString();
    }

    private String num(Object v) {
        if (v == null) return "?";
        double d = ((Number) v).doubleValue();
        return String.valueOf(Math.round(d * 10) / 10.0);
    }

    private Integer intVal(Object v) {
        return v == null ? null : ((Number) v).intValue();
    }

    /** WMO 天气代码 → 中文描述（与前端 weatherCodes.js 保持一致） */
    static String weatherText(Integer code) {
        if (code == null) return "未知";
        return switch (code) {
            case 0 -> "晴";
            case 1 -> "少云";
            case 2 -> "多云";
            case 3 -> "阴";
            case 45, 48 -> "雾";
            case 51, 53, 55 -> "毛毛雨";
            case 56, 57 -> "冻毛毛雨";
            case 61 -> "小雨";
            case 63 -> "中雨";
            case 65 -> "大雨";
            case 66, 67 -> "冻雨";
            case 71 -> "小雪";
            case 73 -> "中雪";
            case 75 -> "大雪";
            case 77 -> "雪粒";
            case 80 -> "小阵雨";
            case 81 -> "中阵雨";
            case 82 -> "强阵雨";
            case 85, 86 -> "阵雪";
            case 95 -> "雷暴";
            case 96, 99 -> "雷暴伴冰雹";
            default -> "未知";
        };
    }
}
