package com.agriweather.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertResult {
    private String alertType;
    private String alertLevel;
    private String alertContent;
    private String suggestion;
    private boolean triggered;
}
