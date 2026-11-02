package com.agriweather.controller;

import com.agriweather.entity.FarmPlanTask;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmPlanTaskRepository;
import com.agriweather.repository.FarmlandRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 首页「今日农事」：当前用户所有地块今天到期/已逾期的待办任务 */
@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class FarmTaskTodayController {

    private final FarmlandRepository farmlandRepository;
    private final FarmPlanTaskRepository taskRepository;

    @GetMapping("/today")
    public List<Map<String, Object>> today(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }

        List<Farmland> fields = farmlandRepository.findByUserId(userId);
        if (fields.isEmpty()) return List.of();
        Map<Long, Farmland> byId = fields.stream()
                .collect(Collectors.toMap(Farmland::getId, field -> field));

        List<FarmPlanTask> tasks = taskRepository
                .findByFarmlandIdInAndStatusAndPlannedDateLessThanEqual(
                        byId.keySet(), "PENDING", LocalDate.now());
        tasks.sort(Comparator.comparing(FarmPlanTask::getPlannedDate,
                Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(FarmPlanTask::getId));

        List<Map<String, Object>> result = new ArrayList<>();
        for (FarmPlanTask task : tasks) {
            Farmland field = byId.get(task.getFarmlandId());
            if (field == null) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", task.getId());
            item.put("farmlandId", task.getFarmlandId());
            item.put("farmlandName", field.getFieldName());
            item.put("title", task.getTitle());
            item.put("taskType", task.getTaskType());
            item.put("plannedDate", task.getPlannedDate() == null ? null : task.getPlannedDate().toString());
            item.put("overdue", task.getPlannedDate() != null
                    && task.getPlannedDate().isBefore(LocalDate.now()));
            result.add(item);
        }
        return result;
    }
}