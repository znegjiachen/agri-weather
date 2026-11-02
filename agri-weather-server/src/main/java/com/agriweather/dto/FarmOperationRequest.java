package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class FarmOperationRequest {

    @NotBlank(message = "请选择农事类型")
    @Size(max = 20, message = "农事类型过长")
    private String operationType;

    /** YYYY-MM-DD；为空时使用今天 */
    private String operationDate;

    @Size(max = 100)
    private String weatherCondition;

    @Size(max = 500)
    private String detail;

    @Size(max = 100)
    private String fertilizer;

    @Size(max = 100)
    private String pesticide;

    @Size(max = 50)
    private String operator;

    @Size(max = 500)
    private String notes;
}