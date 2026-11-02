package com.agriweather.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PlanTaskUpdateRequest {

    @Pattern(regexp = "PENDING|DONE|SKIPPED", message = "任务状态不正确")
    private String status;

    /** YYYY-MM-DD，完成时为空则使用今天 */
    private String actualDate;

    @Size(max = 500)
    private String notes;
}