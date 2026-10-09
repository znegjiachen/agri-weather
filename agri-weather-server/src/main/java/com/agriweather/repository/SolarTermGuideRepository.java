package com.agriweather.repository;

import com.agriweather.entity.SolarTermGuide;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SolarTermGuideRepository extends JpaRepository<SolarTermGuide, Long> {
    Optional<SolarTermGuide> findByTermName(String termName);
}
