package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "weather_alert")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "farmland_id")
    private Long farmlandId;

    @Column(name = "alert_type", length = 30)
    private String alertType;

    @Column(name = "alert_level", length = 10)
    private String alertLevel;

    @Column(name = "alert_content", length = 500)
    private String alertContent;

    @Column(length = 500)
    private String suggestion;

    @Column(name = "alert_time")
    @Builder.Default
    private LocalDateTime alertTime = LocalDateTime.now();

    @Builder.Default
    private Boolean isRead = false;

    @Builder.Default
    private Boolean isHandled = false;

    @Transient
    private String farmlandName;

    @Transient
    private String cropName;
}
