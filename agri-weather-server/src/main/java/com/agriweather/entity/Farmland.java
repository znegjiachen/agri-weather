package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "farmland")
@Data
@NoArgsConstructor
public class Farmland {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "field_name", nullable = false, length = 100)
    private String fieldName;

    @Column(nullable = false)
    private Double lat;

    @Column(nullable = false)
    private Double lng;

    private Double altitude;

    @Column(name = "area_mu")
    private Double areaMu;

    @Column(name = "soil_type", length = 30)
    private String soilType;

    @Column(name = "crop_id")
    private Long cropId;

    @Column(name = "plant_date")
    private LocalDate plantDate;

    @Column(name = "irrigation_type", length = 20)
    private String irrigationType;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
