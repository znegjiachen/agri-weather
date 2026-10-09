package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "solar_term_guide")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SolarTermGuide {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "term_name", nullable = false, length = 20)
    private String termName;

    @Column(name = "term_date_range", length = 30)
    private String termDateRange;

    @Column(name = "crop_stages", length = 500)
    private String cropStages;

    @Column(name = "farm_tasks", length = 1000)
    private String farmTasks;

    @Column(name = "pest_risks", length = 500)
    private String pestRisks;

    @Column(name = "traditional_tips", length = 1000)
    private String traditionalTips;
}
