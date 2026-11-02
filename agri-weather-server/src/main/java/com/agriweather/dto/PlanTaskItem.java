package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PlanTaskItem {

    @NotBlank(message = "任务标题不能为空")
    @Size(max = 200, message = "任务标题过长")
    private String title;

    /** SOW / FERTILIZE / SPRAY / IRRIGATE / HARVEST / OTHER */
    private String taskType;

    /** YYYY-MM-DD，可为空 */
    private String plannedDate;

    @Size(max = 500)
    private String sourceQuote;

    @Size(max = 500)
    private String notes;
}