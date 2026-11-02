package com.agriweather.service;

import com.agriweather.entity.FarmPlanTask;
import com.agriweather.entity.Farmland;
import com.agriweather.push.WebPushService;
import com.agriweather.repository.FarmPlanTaskRepository;
import com.agriweather.repository.FarmlandRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/** 每天检查到期/逾期任务，通过 Web Push 提醒；同一天每任务只提醒一次 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FarmTaskReminderScheduler {

    private final FarmPlanTaskRepository taskRepository;
    private final FarmlandRepository farmlandRepository;
    private final WebPushService webPushService;

    @Scheduled(cron = "${app.tasks.reminder-cron:0 10 7 * * *}")
    public void remindDueTasks() {
        LocalDate today = LocalDate.now();
        List<FarmPlanTask> tasks = taskRepository
                .findByStatusAndPlannedDateLessThanEqual("PENDING", today);
        int sent = 0;

        for (FarmPlanTask task : tasks) {
            if (task.getLastRemindedDate() != null
                    && !task.getLastRemindedDate().isBefore(today)) {
                continue;
            }
            Farmland farmland = farmlandRepository.findById(task.getFarmlandId()).orElse(null);
            if (farmland == null) continue;

            webPushService.notifyUserAsync(
                    farmland.getUserId(),
                    "今日农事任务",
                    farmland.getFieldName() + " · " + task.getTitle(),
                    "/home/farmlands");
            task.setLastRemindedDate(today);
            taskRepository.save(task);
            sent++;
        }

        if (sent > 0) log.info("农事任务提醒完成 count={}", sent);
    }
}