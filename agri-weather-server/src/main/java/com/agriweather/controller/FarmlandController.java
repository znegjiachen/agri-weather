package com.agriweather.controller;

import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.service.FarmlandWeatherService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/farmlands")
@RequiredArgsConstructor
public class FarmlandController {

    private final FarmlandRepository farmlandRepository;
    private final FarmlandWeatherService farmlandWeatherService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public List<Farmland> listMine(HttpServletRequest request) {
        Long userId = getUserIdOrAuthError(request);
        return farmlandRepository.findByUserId(userId);
    }

    @PostMapping
    public Farmland create(@RequestBody String rawBody, HttpServletRequest request) throws Exception {
        Long userId = getUserIdOrAuthError(request);

        Map<String, Object> body = objectMapper.readValue(rawBody, new TypeReference<Map<String, Object>>() {});

        Farmland f = new Farmland();
        f.setUserId(userId);
        f.setFieldName(str(body, "fieldName"));
        f.setLat(dbl(body, "lat"));
        f.setLng(dbl(body, "lng"));
        f.setAltitude(dbl(body, "altitude"));
        f.setAreaMu(dbl(body, "areaMu"));
        f.setSoilType(str(body, "soilType"));
        if (body.get("cropId") != null) f.setCropId(lng(body, "cropId"));
        f.setIrrigationType(str(body, "irrigationType"));
        String pd = str(body, "plantDate");
        if (pd != null && !pd.isEmpty()) f.setPlantDate(LocalDate.parse(pd));

        return farmlandRepository.save(f);
    }

    @PutMapping("/{id}")
    public Farmland update(@PathVariable Long id, @RequestBody String rawBody, HttpServletRequest request) throws Exception {
        Long userId = getUserIdOrAuthError(request);
        Farmland f = requireOwned(id, userId);

        Map<String, Object> body = objectMapper.readValue(rawBody, new TypeReference<Map<String, Object>>() {});

        if (body.containsKey("fieldName")) f.setFieldName(str(body, "fieldName"));
        if (body.containsKey("lat")) f.setLat(dbl(body, "lat"));
        if (body.containsKey("lng")) f.setLng(dbl(body, "lng"));
        if (body.containsKey("altitude")) f.setAltitude(dbl(body, "altitude"));
        if (body.containsKey("areaMu")) f.setAreaMu(dbl(body, "areaMu"));
        if (body.containsKey("soilType")) f.setSoilType(str(body, "soilType"));
        if (body.containsKey("cropId")) f.setCropId(lng(body, "cropId"));
        if (body.containsKey("irrigationType")) f.setIrrigationType(str(body, "irrigationType"));
        if (body.containsKey("plantDate")) {
            String pd = str(body, "plantDate");
            if (pd != null && !pd.isEmpty()) f.setPlantDate(LocalDate.parse(pd));
        }

        return farmlandRepository.save(f);
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
        farmlandRepository.deleteById(id);
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

    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v != null ? v.toString() : null;
    }
    private Double dbl(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).doubleValue();
        return Double.parseDouble(v.toString());
    }
    private Long lng(Map<String, Object> m, String k) {
        Object v = m.get(k);
        if (v == null) return null;
        if (v instanceof Number) return ((Number) v).longValue();
        return Long.parseLong(v.toString());
    }
}
