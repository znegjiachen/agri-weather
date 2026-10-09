package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "farm_operation")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FarmOperation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farmland_id", nullable = false)
    private Long farmlandId;

    @Column(name = "operation_type", length = 20)
    private String operationType;

    @Column(name = "operation_date")
    private LocalDate operationDate;

    @Column(name = "weather_condition", length = 100)
    private String weatherCondition;

    @Column(length = 500)
    private String detail;

    @Column(length = 100)
    private String fertilizer;

    @Column(length = 100)
    private String pesticide;

    @Column(length = 50)
    private String operator;

    @Column(length = 500)
    private String notes;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
