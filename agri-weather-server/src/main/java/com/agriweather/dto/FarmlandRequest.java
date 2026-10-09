package com.agriweather.dto;

import lombok.Data;

@Data
public class FarmlandRequest {
    private String fieldName;
    private Double lat;
    private Double lng;
    private Double altitude;
    private Double areaMu;
    private String soilType;
    private Long cropId;
    private String plantDate;
    private String irrigationType;
}
