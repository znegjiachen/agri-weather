package com.agriweather.repository;

import com.agriweather.entity.CropGrowthStage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CropGrowthStageRepository extends JpaRepository<CropGrowthStage, Long> {
    List<CropGrowthStage> findByCropIdOrderByStageOrder(Long cropId);
}
