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

    /** 适宜播种期，按主要产区概括，如「华南 2-3 月；北方 4-5 月」 */
    @Column(name = "sowing_period", length = 120)
    private String sowingPeriod;

    @Builder.Default
    private Boolean frostSensitive = false;

    @Builder.Default
    private Boolean heatSensitive = false;

    @Builder.Default
    private Boolean waterlogSensitive = false;
}
