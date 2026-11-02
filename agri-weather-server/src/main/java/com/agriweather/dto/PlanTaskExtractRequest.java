package com.agriweather.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PlanTaskExtractRequest {

    @NotNull(message = "请先上传方案文档")
    private Long documentId;
}