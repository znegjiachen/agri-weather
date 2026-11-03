package com.agriweather.repository;

import com.agriweather.entity.FarmlandSeason;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FarmlandSeasonRepository extends JpaRepository<FarmlandSeason, Long> {

    List<FarmlandSeason> findByFarmlandIdOrderByPlantDateDescIdDesc(Long farmlandId);

    List<FarmlandSeason> findByFarmlandId(Long farmlandId);

    void deleteByFarmlandId(Long farmlandId);
}