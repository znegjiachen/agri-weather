package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 地块的一季种植记录；换茬时新增，不覆盖历史 */
@Entity
@Table(name = "farmland_season")
@Data
@NoArgsConstructor
public class FarmlandSeason {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farmland_id", nullable = false)
    private Long farmlandId;

    @Column(name = "crop_id")
    private Long cropId;

    @Column(name = "season_name", length = 50)
    private String seasonName;

    @Column(name = "plant_date")
    private LocalDate plantDate;

    @Column(name = "expected_harvest_date")
    private LocalDate expectedHarvestDate;

    @Column(name = "harvest_date")
    private LocalDate harvestDate;

    /** PLANTED / HARVESTED / FALLOW */
    @Column(nullable = false, length = 20)
    private String status = "PLANTED";

    @Column(length = 500)
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}