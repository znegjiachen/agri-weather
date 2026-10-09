package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "crop_growth_stage")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CropGrowthStage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "crop_id", nullable = false)
    private Long cropId;

    @Column(name = "stage_name", nullable = false, length = 30)
    private String stageName;

    @Column(name = "stage_order")
    private Integer stageOrder;

    @Column(name = "stage_days")
    private Integer stageDays;

    private Double tempMin;
    private Double tempMax;
    private Double humidityMin;
    private Double humidityMax;
    private Double rainfallNeed;
    private Double lightNeed;

    @Column(name = "pest_risk_level", length = 10)
    private String pestRiskLevel;

    @Column(name = "key_warnings", length = 500)
    private String keyWarnings;
}
