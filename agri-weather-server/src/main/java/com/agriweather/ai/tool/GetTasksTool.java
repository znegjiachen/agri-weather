package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.agent.Tool;
import com.agriweather.agent.ToolArgs;
import com.agriweather.ai.AgriContext;
import com.agriweather.entity.FarmPlanTask;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmPlanTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** 查询地块的计划任务：今日待办、未来任务或全部任务 */
@Component
@RequiredArgsConstructor
public class GetTasksTool implements Tool {

    private static final int MAX_RESULTS = 20;

    private final FarmPlanTaskRepository taskRepository;
    private final FarmlandAccessGuard guard;

    @Override
    public String name() {
        return "get_tasks";
    }

    @Override
    public String description() {
        return "查询指定地块的计划任务和农事待办。scope=TODAY 返回今天到期和已逾期任务，"
                + "UPCOMING 返回未来任务，ALL 返回全部任务。适合回答「今天要干什么」「还有哪些活没做」。";
    }

    @Override
    public Map<String, Object> parameters() {
        return Map.of(
                "farmlandId", Map.of(
                        "type", "integer",
                        "description", "地块ID，可通过 list_farmlands 获得"),
                "scope", Map.of(
                        "type", "string",
                        "enum", List.of("TODAY", "UPCOMING", "ALL"),
                        "description", "查询范围")
        );
    }

    @Override
    public Object execute(AgentContext<?> context, Map<String, Object> args) {
        Long farmlandId = ToolArgs.argLong(args, "farmlandId");
        String scope = ToolArgs.argStr(args, "scope");
        String normalizedScope = scope == null ? "TODAY" : scope.trim().toUpperCase(Locale.ROOT);
        if (!List.of("TODAY", "UPCOMING", "ALL").contains(normalizedScope)) {
            throw new IllegalArgumentException("scope 只能是 TODAY、UPCOMING 或 ALL");
        }

        AgriContext ctx = context.payload(AgriContext.class);
        Farmland field = guard.requireOwned(farmlandId, ctx);
        LocalDate today = LocalDate.now();

        List<FarmPlanTask> tasks = new ArrayList<>(taskRepository
                .findByFarmlandIdOrderByPlannedDateAscIdAsc(farmlandId));
        tasks.sort(Comparator.comparing(FarmPlanTask::getPlannedDate,
                Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(FarmPlanTask::getId));

        List<Map<String, Object>> result = new ArrayList<>();
        for (FarmPlanTask task : tasks) {
            boolean pending = "PENDING".equals(task.getStatus());
            boolean due = task.getPlannedDate() != null && !task.getPlannedDate().isAfter(today);
            if ("TODAY".equals(normalizedScope) && !(pending && due)) continue;
            if ("UPCOMING".equals(normalizedScope)
                    && !(pending && task.getPlannedDate() != null && task.getPlannedDate().isAfter(today))) {
                continue;
            }
            result.add(toBrief(task, today));
            if (result.size() >= MAX_RESULTS) break;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("farmland", field.getFieldName());
        response.put("scope", normalizedScope);
        response.put("count", result.size());
        response.put("tasks", result);
        if (result.isEmpty()) {
            response.put("message", "该地块在当前范围内没有任务");
        }
        return response;
    }

    private Map<String, Object> toBrief(FarmPlanTask task, LocalDate today) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", task.getId());
        item.put("title", task.getTitle());
        item.put("taskType", task.getTaskType());
        item.put("status", task.getStatus());
        item.put("plannedDate", task.getPlannedDate() == null ? null : task.getPlannedDate().toString());
        item.put("actualDate", task.getActualDate() == null ? null : task.getActualDate().toString());
        item.put("overdue", task.getPlannedDate() != null
                && "PENDING".equals(task.getStatus())
                && task.getPlannedDate().isBefore(today));
        item.put("sourceName", task.getSourceName());
        item.put("notes", task.getNotes());
        return item;
    }
}
