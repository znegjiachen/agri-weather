package com.agriweather.controller;

import com.agriweather.dto.PlanTaskConfirmRequest;
import com.agriweather.dto.PlanTaskExtractRequest;
import com.agriweather.dto.PlanTaskItem;
import com.agriweather.dto.PlanTaskUpdateRequest;
import com.agriweather.entity.FarmOperation;
import com.agriweather.entity.FarmPlanTask;
import com.agriweather.entity.Farmland;
import com.agriweather.entity.FarmlandSeason;
import com.agriweather.repository.FarmOperationRepository;
import com.agriweather.repository.FarmPlanTaskRepository;
import com.agriweather.repository.FarmlandRepository;
import com.agriweather.repository.FarmlandSeasonRepository;
import com.agriweather.service.AgentDocumentService;
import com.agriweather.service.PlanTaskExtractionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 方案任务：抽取 → 确认 → 执行 → 偏差统计。
 */
@RestController
@RequestMapping("/api/farmlands/{farmlandId}/tasks")
@RequiredArgsConstructor
public class FarmlandTaskController {

    private final FarmlandRepository farmlandRepository;
    private final FarmlandSeasonRepository seasonRepository;
    private final FarmPlanTaskRepository taskRepository;
    private final FarmOperationRepository operationRepository;
    private final AgentDocumentService documentService;
    private final PlanTaskExtractionService extractionService;

    @GetMapping
    public List<FarmPlanTask> list(@PathVariable Long farmlandId, HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        return taskRepository.findByFarmlandIdOrderByPlannedDateAscIdAsc(farmlandId);
    }

    /** 从方案文档抽取任务，只返回预览，不落库 */
    @PostMapping("/extract")
    public List<PlanTaskItem> extract(@PathVariable Long farmlandId,
                                      @Valid @RequestBody PlanTaskExtractRequest body,
                                      HttpServletRequest request) {
        Long userId = userId(request);
        Farmland farmland = requireFarmland(farmlandId, userId);
        String text;
        try {
            text = documentService.documentText(userId, body.getDocumentId());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        try {
            return extractionService.extract(null, text, farmland.getPlantDate());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** 用户确认后保存任务 */
    @PostMapping("/confirm")
    public List<FarmPlanTask> confirm(@PathVariable Long farmlandId,
                                      @Valid @RequestBody PlanTaskConfirmRequest body,
                                      HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        // 未指定季节时挂到当前在种的那一季，完成换茬时才能一起收口
        Long seasonId = body.getSeasonId();
        if (seasonId == null) {
            seasonId = seasonRepository.findByFarmlandIdOrderByPlantDateDescIdDesc(farmlandId)
                    .stream()
                    .filter(season -> "PLANTED".equals(season.getStatus()))
                    .map(FarmlandSeason::getId)
                    .findFirst()
                    .orElse(null);
        }
        List<FarmPlanTask> saved = new ArrayList<>();
        for (PlanTaskItem item : body.getTasks()) {
            FarmPlanTask task = new FarmPlanTask();
            task.setFarmlandId(farmlandId);
            task.setSeasonId(seasonId);
            applyItem(task, item);
            task.setSourceName(truncate(body.getSourceName(), 255));
            saved.add(taskRepository.save(task));
        }
        return saved;
    }

    @PutMapping("/{taskId}")
    public FarmPlanTask update(@PathVariable Long farmlandId,
                               @PathVariable Long taskId,
                               @Valid @RequestBody PlanTaskUpdateRequest body,
                               HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        FarmPlanTask task = requireTask(farmlandId, taskId);

        if (body.getStatus() != null) task.setStatus(body.getStatus());
        if (body.getActualDate() != null && !body.getActualDate().isBlank()) {
            task.setActualDate(parseDate(body.getActualDate(), "实际完成日期"));
        }
        if (body.getNotes() != null) task.setNotes(truncate(body.getNotes(), 500));
        task.setUpdatedAt(java.time.LocalDateTime.now());

        if ("DONE".equals(task.getStatus())) {
            if (task.getActualDate() == null) task.setActualDate(LocalDate.now());
            if (task.getOperationId() == null) {
                FarmOperation operation = new FarmOperation();
                operation.setFarmlandId(farmlandId);
                operation.setOperationType(operationType(task.getTaskType()));
                operation.setOperationDate(task.getActualDate());
                operation.setDetail(task.getTitle());
                operation.setNotes(task.getNotes());
                operation = operationRepository.save(operation);
                task.setOperationId(operation.getId());
            }
        }
        return taskRepository.save(task);
    }

    @DeleteMapping("/{taskId}")
    public void delete(@PathVariable Long farmlandId,
                       @PathVariable Long taskId,
                       HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        taskRepository.delete(requireTask(farmlandId, taskId));
    }

    /** 计划 vs 实际：完成率、按时率、延误和逾期列表 */
    @GetMapping("/summary")
    public Map<String, Object> summary(@PathVariable Long farmlandId, HttpServletRequest request) {
        requireFarmland(farmlandId, userId(request));
        List<FarmPlanTask> tasks = taskRepository.findByFarmlandIdOrderByPlannedDateAscIdAsc(farmlandId);
        LocalDate today = LocalDate.now();
        int done = 0;
        int skipped = 0;
        int pending = 0;
        int overdue = 0;
        int onTime = 0;
        List<Map<String, Object>> delayed = new ArrayList<>();

        for (FarmPlanTask task : tasks) {
            if ("DONE".equals(task.getStatus())) {
                done++;
                if (task.getPlannedDate() != null && task.getActualDate() != null) {
                    long days = ChronoUnit.DAYS.between(task.getPlannedDate(), task.getActualDate());
                    if (days <= 0) onTime++;
                    else delayed.add(delayItem(task, days));
                } else {
                    onTime++;
                }
            } else if ("SKIPPED".equals(task.getStatus())) {
                skipped++;
            } else {
                pending++;
                if (task.getPlannedDate() != null && task.getPlannedDate().isBefore(today)) {
                    overdue++;
                }
            }
        }

        int total = tasks.size();
        int finished = done + skipped;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total);
        result.put("done", done);
        result.put("skipped", skipped);
        result.put("pending", pending);
        result.put("overdue", overdue);
        result.put("completionRate", total == 0 ? 0
                : Math.round((double) finished / total * 1000) / 10.0);
        result.put("onTimeRate", done == 0 ? 0
                : Math.round((double) onTime / done * 1000) / 10.0);
        result.put("delayed", delayed);
        return result;
    }

    private Map<String, Object> delayItem(FarmPlanTask task, long days) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", task.getId());
        item.put("title", task.getTitle());
        item.put("plannedDate", task.getPlannedDate() == null ? null : task.getPlannedDate().toString());
        item.put("actualDate", task.getActualDate() == null ? null : task.getActualDate().toString());
        item.put("days", days);
        return item;
    }

    private void applyItem(FarmPlanTask task, PlanTaskItem item) {
        task.setTitle(truncate(item.getTitle(), 200));
        task.setTaskType(item.getTaskType() == null ? "OTHER" : item.getTaskType());
        task.setPlannedDate(parseDate(item.getPlannedDate(), "计划日期"));
        task.setSourceQuote(truncate(item.getSourceQuote(), 500));
        task.setNotes(truncate(item.getNotes(), 500));
        task.setStatus("PENDING");
    }

    private FarmPlanTask requireTask(Long farmlandId, Long taskId) {
        return taskRepository.findById(taskId)
                .filter(task -> Objects.equals(task.getFarmlandId(), farmlandId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "任务不存在"));
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

    private String operationType(String taskType) {
        if (taskType == null) return "其他";
        return switch (taskType) {
            case "SOW" -> "播种";
            case "FERTILIZE" -> "施肥";
            case "SPRAY" -> "打药";
            case "IRRIGATE" -> "灌溉";
            case "HARVEST" -> "收获";
            default -> "其他";
        };
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}