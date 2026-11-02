package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 由种植方案抽取/人工创建的一条农事任务 */
@Entity
@Table(name = "farm_plan_task")
@Data
@NoArgsConstructor
public class FarmPlanTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farmland_id", nullable = false)
    private Long farmlandId;

    @Column(name = "season_id")
    private Long seasonId;

    @Column(nullable = false, length = 200)
    private String title;

    /** SOW / FERTILIZE / SPRAY / IRRIGATE / HARVEST / OTHER */
    @Column(name = "task_type", length = 20)
    private String taskType;

    @Column(name = "planned_date")
    private LocalDate plannedDate;

    /** PENDING / DONE / SKIPPED */
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "actual_date")
    private LocalDate actualDate;

    /** 完成时自动生成的农事记录 ID */
    @Column(name = "operation_id")
    private Long operationId;

    @Column(name = "source_name", length = 255)
    private String sourceName;

    @Column(name = "source_quote", length = 500)
    private String sourceQuote;

    @Column(length = 500)
    private String notes;

    @Column(name = "last_reminded_date")
    private LocalDate lastRemindedDate;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}