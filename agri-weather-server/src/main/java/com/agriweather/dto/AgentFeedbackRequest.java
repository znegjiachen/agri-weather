package com.agriweather.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AgentFeedbackRequest {

    @NotBlank(message = "请选择评价")
    @Pattern(regexp = "UP|DOWN", message = "评价只能是 UP 或 DOWN")
    private String rating;

    @Size(max = 500, message = "补充说明不能超过 500 字")
    private String comment;
}