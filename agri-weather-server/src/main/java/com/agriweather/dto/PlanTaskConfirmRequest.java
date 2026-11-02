package com.agriweather.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class PlanTaskConfirmRequest {

    @NotEmpty(message = "没有可保存的任务")
    @Size(max = 50, message = "一次最多保存 50 条任务")
    @Valid
    private List<PlanTaskItem> tasks;

    @Size(max = 255)
    private String sourceName;

    private Long seasonId;
}