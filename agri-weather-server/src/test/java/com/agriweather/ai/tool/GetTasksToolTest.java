package com.agriweather.ai.tool;

import com.agriweather.agent.AgentContext;
import com.agriweather.ai.AgriContext;
import com.agriweather.entity.FarmPlanTask;
import com.agriweather.entity.Farmland;
import com.agriweather.repository.FarmPlanTaskRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GetTasksToolTest {

    private static final AgentContext<AgriContext> CTX =
            AgentContext.of(new AgriContext(42L));

    @Test
    @DisplayName("TODAY 返回今日到期和已逾期的待办，不返回已完成或未来任务")
    @SuppressWarnings("unchecked")
    void todayReturnsOverdueAndDuePending() {
        FarmPlanTaskRepository repo = mock(FarmPlanTaskRepository.class);
        FarmlandAccessGuard guard = mock(FarmlandAccessGuard.class);
        when(guard.requireOwned(eq(7L), any(AgriContext.class))).thenReturn(field("3号田"));
        when(repo.findByFarmlandIdOrderByPlannedDateAscIdAsc(7L)).thenReturn(List.of(
                task(1L, "补苗", LocalDate.now().minusDays(2), "PENDING"),
                task(2L, "追肥", LocalDate.now(), "PENDING"),
                task(3L, "打药", LocalDate.now().plusDays(2), "PENDING"),
                task(4L, "灌溉", LocalDate.now().minusDays(1), "DONE")));

        GetTasksTool tool = new GetTasksTool(repo, guard);
        Map<String, Object> result = (Map<String, Object>) tool.execute(
                CTX, Map.of("farmlandId", 7L, "scope", "TODAY"));

        List<Map<String, Object>> tasks = (List<Map<String, Object>>) result.get("tasks");
        assertEquals(2, tasks.size());
        assertEquals("补苗", tasks.get(0).get("title"));
        assertEquals(Boolean.TRUE, tasks.get(0).get("overdue"));
        assertEquals("3号田", result.get("farmland"));
    }

    @Test
    @DisplayName("UPCOMING 只返回今天之后的待办")
    @SuppressWarnings("unchecked")
    void upcomingReturnsFuturePendingOnly() {
        FarmPlanTaskRepository repo = mock(FarmPlanTaskRepository.class);
        FarmlandAccessGuard guard = mock(FarmlandAccessGuard.class);
        when(guard.requireOwned(eq(7L), any(AgriContext.class))).thenReturn(field("3号田"));
        when(repo.findByFarmlandIdOrderByPlannedDateAscIdAsc(7L)).thenReturn(List.of(
                task(1L, "补苗", LocalDate.now().minusDays(2), "PENDING"),
                task(2L, "打药", LocalDate.now().plusDays(2), "PENDING")));

        GetTasksTool tool = new GetTasksTool(repo, guard);
        Map<String, Object> result = (Map<String, Object>) tool.execute(
                CTX, Map.of("farmlandId", 7L, "scope", "UPCOMING"));

        List<Map<String, Object>> tasks = (List<Map<String, Object>>) result.get("tasks");
        assertEquals(1, tasks.size());
        assertEquals("打药", tasks.get(0).get("title"));
    }

    @Test
    @DisplayName("没有任务时返回可读提示")
    @SuppressWarnings("unchecked")
    void emptyScopeReturnsMessage() {
        FarmPlanTaskRepository repo = mock(FarmPlanTaskRepository.class);
        FarmlandAccessGuard guard = mock(FarmlandAccessGuard.class);
        when(guard.requireOwned(eq(7L), any(AgriContext.class))).thenReturn(field("3号田"));
        when(repo.findByFarmlandIdOrderByPlannedDateAscIdAsc(7L)).thenReturn(List.of());

        GetTasksTool tool = new GetTasksTool(repo, guard);
        Map<String, Object> result = (Map<String, Object>) tool.execute(
                CTX, Map.of("farmlandId", 7L, "scope", "TODAY"));

        assertEquals(0, result.get("count"));
        assertTrue(String.valueOf(result.get("message")).contains("没有任务"));
    }

    @Test
    @DisplayName("非法 scope 给出可读错误")
    void invalidScopeRejected() {
        GetTasksTool tool = new GetTasksTool(
                mock(FarmPlanTaskRepository.class), mock(FarmlandAccessGuard.class));

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> tool.execute(CTX, Map.of("farmlandId", 7L, "scope", "TOMORROW")));
        assertTrue(e.getMessage().contains("TODAY"));
    }

    private Farmland field(String name) {
        Farmland f = new Farmland();
        f.setId(7L);
        f.setUserId(42L);
        f.setFieldName(name);
        return f;
    }

    private FarmPlanTask task(Long id, String title, LocalDate date, String status) {
        FarmPlanTask t = new FarmPlanTask();
        t.setId(id);
        t.setFarmlandId(7L);
        t.setTitle(title);
        t.setPlannedDate(date);
        t.setStatus(status);
        t.setTaskType("OTHER");
        return t;
    }
}
