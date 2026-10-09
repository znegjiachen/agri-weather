package com.agriweather.repository;

import com.agriweather.entity.WeatherAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WeatherAlertRepository extends JpaRepository<WeatherAlert, Long> {
    List<WeatherAlert> findByUserIdOrderByAlertTimeDesc(Long userId);
    List<WeatherAlert> findByFarmlandIdOrderByAlertTimeDesc(Long farmlandId);
    List<WeatherAlert> findByUserIdAndIsReadFalse(Long userId);
    long countByUserIdAndIsReadFalse(Long userId);
}
