package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "crop_info")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CropInfo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "crop_name", nullable = false, length = 50)
    private String cropName;

    @Column(length = 50)
    private String variety;

    @Column(name = "growth_cycle_days")
    private Integer growthCycleDays;

    @Column(name = "suitable_temp_min")
    private Double suitableTempMin;

    @Column(name = "suitable_temp_max")
    private Double suitableTempMax;

    @Column(name = "suitable_humidity_min")
    private Double suitableHumidityMin;

    @Column(name = "suitable_humidity_max")
    private Double suitableHumidityMax;

    @Column(name = "suitable_rainfall")
    private Double suitableRainfall;

    @Column(name = "suitable_light_hours")
    private Double suitableLightHours;

    @Builder.Default
    private Boolean frostSensitive = false;

    @Builder.Default
    private Boolean heatSensitive = false;

    @Builder.Default
    private Boolean waterlogSensitive = false;
}
