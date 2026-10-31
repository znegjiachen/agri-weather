package com.agriweather.controller;

import com.agriweather.dto.FarmlandRequest;
import com.agriweather.entity.Farmland;
import com.agriweather.entity.FarmlandAgent;
import com.agriweather.repository.CropInfoRepository;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.service.AgentService;
import com.agriweather.service.FarmlandGeometry;
import com.agriweather.service.FarmlandWeatherService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@RestController
@RequestMapping("/api/farmlands")
@RequiredArgsConstructor
public class FarmlandController {

    private static final Set<String> SOIL_TYPES =
            Set.of("壤土", "沙土", "黏土", "红壤", "黑土", "盐碱土");
    private static final Set<String> IRRIGATION_TYPES =
            Set.of("漫灌", "滴灌", "喷灌", "渗灌", "雨水");

    private final FarmlandRepository farmlandRepository;
    private final CropInfoRepository cropInfoRepository;
    private final FarmlandWeatherService farmlandWeatherService;
    private final AgentService agentService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public List<Farmland> listMine(HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        List<Farmland> fields = farmlandRepository.findByUserId(userId);
        agentService.attachAgentIds(userId, fields);
        return fields;
    }

    @PostMapping
    public Farmland create(@Valid @RequestBody FarmlandRequest body, HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);

        Farmland f = new Farmland();
        f.setUserId(userId);
        f.setFieldName(requireName(body.getFieldName()));
        f.setLat(requireLat(body.getLat()));
        f.setLng(requireLng(body.getLng()));
        f.setAltitude(validateAltitude(body.getAltitude()));
        f.setAreaMu(validateArea(body.getAreaMu()));
        f.setSoilType(normalizeSoil(body.getSoilType()));
        f.setIrrigationType(normalizeIrrigation(body.getIrrigationType()));
        f.setCropId(requireCrop(body.getCropId()));
        f.setPlantDate(parsePlantDate(body.getPlantDate()));
        f.setBoundary(normalizeBoundary(body.getBoundary()));
        applyBoundaryArea(f);

        Farmland saved = farmlandRepository.save(f);
        FarmlandAgent agent = agentService.ensureForFarmland(saved);
        saved.setAgentId(agent.getId());
        return saved;
    }

    @PutMapping("/{id}")
    public Farmland update(@PathVariable Long id, @RequestBody String rawBody, HttpServletRequest request) throws Exception {
        Long userId = getUserIdOrAuthError(request);
        Farmland f = requireOwned(id, userId);

        Map<String, Object> body = objectMapper.readValue(rawBody, new TypeReference<Map<String, Object>>() {});

        if (body.containsKey("fieldName")) f.setFieldName(requireName(str(body, "fieldName")));
        if (body.containsKey("lat")) f.setLat(requireLat(dbl(body, "lat")));
        if (body.containsKey("lng")) f.setLng(requireLng(dbl(body, "lng")));
        if (body.containsKey("altitude")) f.setAltitude(validateAltitude(dbl(body, "altitude")));
        if (body.containsKey("areaMu")) f.setAreaMu(validateArea(dbl(body, "areaMu")));
        if (body.containsKey("soilType")) f.setSoilType(normalizeSoil(str(body, "soilType")));
        if (body.containsKey("irrigationType")) f.setIrrigationType(normalizeIrrigation(str(body, "irrigationType")));
        if (body.containsKey("cropId")) f.setCropId(requireCrop(lng(body, "cropId")));
        if (body.containsKey("plantDate")) f.setPlantDate(parsePlantDate(str(body, "plantDate")));

        boolean boundaryCleared = false;
        if (body.containsKey("boundary")) {
            f.setBoundary(normalizeBoundary(body.get("boundary")));
            boundaryCleared = f.getBoundary() == null && !body.containsKey("areaMu");
        }
        applyBoundaryArea(f);
        if (boundaryCleared) f.setAreaMu(null);

        Farmland saved = farmlandRepository.save(f);
        agentService.refreshDefaultAfterFarmlandUpdate(saved);
        FarmlandAgent agent = agentService.ensureForFarmland(saved);
        saved.setAgentId(agent.getId());
        return saved;
    }

    @GetMapping("/{id}/weather")
    public ResponseEntity<Map<String, Object>> getWeather(@PathVariable Long id, HttpServletRequest request) {
        requireOwned(id, getUserIdOrAuthError(request));

        Map<String, Object> body = new LinkedHashMap<>(farmlandWeatherService.fetchWeather(id));
        // _cache 是内部标记，转成响应头后从响应体里移除
        String cacheStatus = String.valueOf(body.remove("_cache"));
        return ResponseEntity.ok()
                .header("X-Weather-Cache", cacheStatus)
                .body(body);
    }

    @GetMapping("/{id}/alerts")
    public List<Map<String, Object>> checkAlerts(@PathVariable Long id, HttpServletRequest request) throws Exception {
        requireOwned(id, getUserIdOrAuthError(request));
        return farmlandWeatherService.checkAlerts(id);
    }

    @GetMapping("/{id}/advice")
    public List<Map<String, Object>> getAdvice(@PathVariable Long id, HttpServletRequest request) throws Exception {
        requireOwned(id, getUserIdOrAuthError(request));
        return farmlandWeatherService.getOperationAdvice(id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        requireOwned(id, userId);
        agentService.deleteFarmlandAndAgent(id, userId);
    }

    /** 地块必须存在且属于当前用户，否则 404 / 403 */
    private Farmland requireOwned(Long id, Long userId) {
        Farmland f = farmlandRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "地块不存在"));
        if (!Objects.equals(f.getUserId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该地块");
        }
        return f;
    }

    private Long getUserIdOrAuthError(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        return userId;
    }

    // ---------------- 字段校验：统一 400，避免把数据库约束抛成 500 ----------------

    private String requireName(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("请填写地块名称");
        }
        String name = raw.trim();
        if (name.length() > 100) {
            throw new IllegalArgumentException("地块名称不能超过 100 个字符");
        }
        return name;
    }

    private Double requireLat(Double value) {
        if (value == null || !Double.isFinite(value)) {
            throw new IllegalArgumentException("请填写纬度");
        }
        if (value < -90 || value > 90) {
            throw new IllegalArgumentException("纬度需在 -90 ~ 90 之间");
        }
        return value;
    }

    private Double requireLng(Double value) {
        if (value == null || !Double.isFinite(value)) {
            throw new IllegalArgumentException("请填写经度");
        }
        if (value < -180 || value > 180) {
            throw new IllegalArgumentException("经度需在 -180 ~ 180 之间");
        }
        return value;
    }

    /** 海拔为空表示未填写 */
    private Double validateAltitude(Double value) {
        if (value == null) return null;
        if (!Double.isFinite(value) || value < -500 || value > 9000) {
            throw new IllegalArgumentException("海拔需在 -500 ~ 9000 米之间");
        }
        return value;
    }

    /** 面积为空表示未知；0 和负数没有意义，直接拒绝 */
    private Double validateArea(Double value) {
        if (value == null) return null;
        if (!Double.isFinite(value) || value <= 0) {
            throw new IllegalArgumentException("面积需大于 0");
        }
        if (value > 1_000_000) {
            throw new IllegalArgumentException("面积过大，请确认单位是否为亩");
        }
        return round2(value);
    }

    private Long requireCrop(Long cropId) {
        if (cropId == null) return null;
        if (!cropInfoRepository.existsById(cropId)) {
            throw new IllegalArgumentException("作物不存在");
        }
        return cropId;
    }

    private LocalDate parsePlantDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("种植日期格式应为 YYYY-MM-DD");
        }
    }

    private String normalizeSoil(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if (!SOIL_TYPES.contains(value)) {
            throw new IllegalArgumentException("土壤类型不支持：" + value);
        }
        return value;
    }

    private String normalizeIrrigation(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if (!IRRIGATION_TYPES.contains(value)) {
            throw new IllegalArgumentException("灌溉方式不支持：" + value);
        }
        return value;
    }

    // ---------------- 边界与面积 ----------------

    /** 有边界时面积以服务端计算结果为准，避免手工面积与图形不一致 */
    private void applyBoundaryArea(Farmland f) {
        if (f.getBoundary() == null || f.getBoundary().isBlank()) return;
        f.setAreaMu(areaFromBoundary(f.getBoundary()));
    }

    private Double areaFromBoundary(String boundaryJson) {
        try {
            List<Map<String, Object>> points = objectMapper.readValue(
                    boundaryJson, new TypeReference<List<Map<String, Object>>>() {});
            List<FarmlandGeometry.Point> polygon = new ArrayList<>(points.size());
            for (Map<String, Object> point : points) {
                polygon.add(new FarmlandGeometry.Point(
                        ((Number) point.get("lat")).doubleValue(),
                        ((Number) point.get("lng")).doubleValue()));
            }
            double areaMu = FarmlandGeometry.areaMu(polygon);
            if (!Double.isFinite(areaMu) || areaMu < 0.01) {
                throw new IllegalArgumentException("地块边界面积过小，请重新圈选");
            }
            return round2(areaMu);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("地块边界格式不正确");
        }
    }

    private static double round2(double value) {
        return Math.round(value * 100d) / 100d;
    }

    /**
     * 边界支持传 JSON 字符串、数组或 JsonNode；统一校验并归一为 [{lat,lng}] JSON 字符串。
     * 只存 WGS84，显示时前端负责转 GCJ-02 叠到高德影像上。
     */
    private String normalizeBoundary(Object raw) {
        if (raw == null) return null;

        Object value = raw;
        if (raw instanceof JsonNode node) {
            if (node.isNull()) return null;
            if (node.isTextual()) {
                String text = node.asText();
                if (text.isBlank()) return null;
                try {
                    value = objectMapper.readValue(text, List.class);
                } catch (Exception e) {
                    throw new IllegalArgumentException("地块边界格式不正确");
                }
            } else if (node.isArray()) {
                value = objectMapper.convertValue(node, List.class);
            } else {
                throw new IllegalArgumentException("地块边界格式不正确");
            }
        } else if (raw instanceof String s) {
            if (s.isBlank()) return null;
            try {
                value = objectMapper.readValue(s, List.class);
            } catch (Exception e) {
                throw new IllegalArgumentException("地块边界格式不正确");
            }
        }
        if (!(value instanceof List<?> list)) {
            throw new IllegalArgumentException("地块边界格式不正确");
        }
        if (list.size() < 3 || list.size() > 200) {
            throw new IllegalArgumentException("地块边界需要 3~200 个点");
        }

        List<Map<String, Object>> points = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> point)) {
                throw new IllegalArgumentException("地块边界格式不正确");
            }
            double lat = coord(point.get("lat"), "纬度");
            double lng = coord(point.get("lng"), "经度");
            points.add(Map.of("lat", lat, "lng", lng));
        }
        try {
            return objectMapper.writeValueAsString(points);
        } catch (Exception e) {
            throw new IllegalArgumentException("地块边界格式不正确");
        }
    }

    private double coord(Object value, String label) {
        double v;
        if (value instanceof Number n) {
            v = n.doubleValue();
        } else {
            try {
                v = Double.parseDouble(String.valueOf(value));
            } catch (Exception e) {
                throw new IllegalArgumentException(label + "格式不正确");
            }
        }
        if (!Double.isFinite(v)) throw new IllegalArgumentException(label + "格式不正确");
        if ("纬度".equals(label) && (v < -90 || v > 90)) {
            throw new IllegalArgumentException("纬度需在 -90 ~ 90 之间");
        }
        if ("经度".equals(label) && (v < -180 || v > 180)) {
            throw new IllegalArgumentException("经度需在 -180 ~ 180 之间");
        }
        return v;
    }

    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v != null ? v.toString() : null;
    }
    private Double dbl(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).doubleValue();
        try {
            return Double.parseDouble(v.toString());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(k + " 格式不正确");
        }
    }
    private Long lng(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        try {
            return Long.parseLong(v.toString());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(k + " 格式不正确");
        }
    }
}