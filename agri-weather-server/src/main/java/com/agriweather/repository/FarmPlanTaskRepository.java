package com.agriweather.repository;

import com.agriweather.entity.FarmPlanTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface FarmPlanTaskRepository extends JpaRepository<FarmPlanTask, Long> {

    List<FarmPlanTask> findByFarmlandIdOrderByPlannedDateAscIdAsc(Long farmlandId);

    List<FarmPlanTask> findByStatusAndPlannedDateLessThanEqual(String status, LocalDate date);
}