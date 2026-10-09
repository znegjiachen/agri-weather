package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "pest_knowledge")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PestKnowledge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pest_name", nullable = false, length = 50)
    private String pestName;

    @Column(name = "pest_type", length = 20)
    private String pestType;

    @Column(name = "trigger_temp_min")
    private Double triggerTempMin;

    @Column(name = "trigger_temp_max")
    private Double triggerTempMax;

    @Column(name = "trigger_humidity_min")
    private Double triggerHumidityMin;

    @Column(name = "trigger_humidity_max")
    private Double triggerHumidityMax;

    @Column(name = "trigger_rain_days")
    private Integer triggerRainDays;

    @Column(name = "high_risk_stages", length = 200)
    private String highRiskStages;

    @Column(length = 500)
    private String prevention;

    @Column(name = "control_method", length = 500)
    private String controlMethod;

    @Column(name = "recommended_pesticide", length = 300)
    private String recommendedPesticide;
}
