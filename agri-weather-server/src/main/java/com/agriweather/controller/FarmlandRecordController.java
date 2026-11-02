package com.agriweather.controller;

import com.agriweather.dto.FarmOperationRequest;
import com.agriweather.dto.FarmlandSeasonRequest;
import com.agriweather.entity.FarmOperation;
import com.agriweather.entity.Farmland;
import com.agriweather.entity.FarmlandSeason;
import com.agriweather.repository.CropInfoRepository;
import com.agriweather.repository.FarmOperationRepository;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.repository.FarmlandSeasonRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;

/** 地块季节历史与农事记录 */
@RestController
@RequestMapping("/api/farmlands/{farmlandId}")
@RequiredArgsConstructor
public class FarmlandRecordController {

    private final FarmlandRepository farmlandRepository;
    private final FarmlandSeasonRepository seasonRepository;
    private final FarmOperationRepository operationRepository;
    private final CropInfoRepository cropRepository;

    @GetMapping("/seasons")
    public List<FarmlandSeason> seasons(@PathVariable Long farmlandId, HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        return seasonRepository.findByFarmlandIdOrderByPlantDateDescIdDesc(farmlandId);
    }

    @PostMapping("/seasons")
    public FarmlandSeason createSeason(@PathVariable Long farmlandId,
                                       @Valid @RequestBody FarmlandSeasonRequest body,
                                       HttpServletRequest request) {
        Farmland farmland = requireFarmland(farmlandId, userId(request));
        FarmlandSeason season = new FarmlandSeason();
        season.setFarmlandId(farmlandId);
        applySeason(season, body);
        season = seasonRepository.save(season);
        mirrorCurrentSeason(farmland, season);
        return season;
    }

    @PutMapping("/seasons/{seasonId}")
    public FarmlandSeason updateSeason(@PathVariable Long farmlandId,
                                       @PathVariable Long seasonId,
                                       @Valid @RequestBody FarmlandSeasonRequest body,
                                       HttpServletRequest request) {
        Farmland farmland = requireFarmland(farmlandId, userId(request));
        FarmlandSeason season = requireSeason(farmlandId, seasonId);
        applySeason(season, body);
        season = seasonRepository.save(season);
        mirrorCurrentSeason(farmland, season);
        return season;
    }

    @DeleteMapping("/seasons/{seasonId}")
    public void deleteSeason(@PathVariable Long farmlandId,
                             @PathVariable Long seasonId,
                             HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        seasonRepository.delete(requireSeason(farmlandId, seasonId));
    }

    @GetMapping("/operations")
    public List<FarmOperation> operations(@PathVariable Long farmlandId, HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        return operationRepository.findByFarmlandIdOrderByOperationDateDesc(farmlandId);
    }

    @PostMapping("/operations")
    public FarmOperation createOperation(@PathVariable Long farmlandId,
                                         @Valid @RequestBody FarmOperationRequest body,
                                         HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        FarmOperation operation = new FarmOperation();
        operation.setFarmlandId(farmlandId);
        applyOperation(operation, body);
        return operationRepository.save(operation);
    }

    @PutMapping("/operations/{operationId}")
    public FarmOperation updateOperation(@PathVariable Long farmlandId,
                                         @PathVariable Long operationId,
                                         @Valid @RequestBody FarmOperationRequest body,
                                         HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        FarmOperation operation = operationRepository.findById(operationId)
                .filter(item -> Objects.equals(item.getFarmlandId(), farmlandId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "农事记录不存在"));
        applyOperation(operation, body);
        return operationRepository.save(operation);
    }

    @DeleteMapping("/operations/{operationId}")
    public void deleteOperation(@PathVariable Long farmlandId,
                                @PathVariable Long operationId,
                                HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        FarmOperation operation = operationRepository.findById(operationId)
                .filter(item -> Objects.equals(item.getFarmlandId(), farmlandId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "农事记录不存在"));
        operationRepository.delete(operation);
    }

    private void applySeason(FarmlandSeason season, FarmlandSeasonRequest body) {
        season.setSeasonName(trimToNull(body.getSeasonName()));
        if (body.getCropId() != null && !cropRepository.existsById(body.getCropId())) {
            throw new IllegalArgumentException("作物不存在");
        }
        season.setCropId(body.getCropId());
        season.setPlantDate(parseDate(body.getPlantDate(), "播种日期"));
        season.setExpectedHarvestDate(parseDate(body.getExpectedHarvestDate(), "预计收获日期"));
        season.setHarvestDate(parseDate(body.getHarvestDate(), "收获日期"));
        season.setStatus(body.getStatus() == null ? "PLANTED" : body.getStatus());
        season.setNotes(trimToNull(body.getNotes()));
    }

    private void mirrorCurrentSeason(Farmland farmland, FarmlandSeason season) {
        if (!"PLANTED".equals(season.getStatus()) || season.getCropId() == null) return;
        farmland.setCropId(season.getCropId());
        farmland.setPlantDate(season.getPlantDate());
        farmlandRepository.save(farmland);
    }

    private void applyOperation(FarmOperation operation, FarmOperationRequest body) {
        operation.setOperationType(body.getOperationType().trim());
        operation.setOperationDate(body.getOperationDate() == null || body.getOperationDate().isBlank()
                ? LocalDate.now() : parseDate(body.getOperationDate(), "作业日期"));
        operation.setWeatherCondition(trimToNull(body.getWeatherCondition()));
        operation.setDetail(trimToNull(body.getDetail()));
        operation.setFertilizer(trimToNull(body.getFertilizer()));
        operation.setPesticide(trimToNull(body.getPesticide()));
        operation.setOperator(trimToNull(body.getOperator()));
        operation.setNotes(trimToNull(body.getNotes()));
    }

    private FarmlandSeason requireSeason(Long farmlandId, Long seasonId) {
        return seasonRepository.findById(seasonId)
                .filter(item -> Objects.equals(item.getFarmlandId(), farmlandId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "季节记录不存在"));
    }

    private Farmland requireFarmland(Long farmlandId, Long userId) {
        Farmland farmland = farmlandRepository.findById(farmlandId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "地块不存在"));
        if (!Objects.equals(farmland.getUserId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该地块");
        }
        return farmland;
    }

    private Long userId(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        return userId;
    }

    private LocalDate parseDate(String value, String label) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(label + "格式应为 YYYY-MM-DD");
        }
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}