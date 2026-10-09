package com.agriweather.repository;

import com.agriweather.entity.FarmOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface FarmOperationRepository extends JpaRepository<FarmOperation, Long> {
    List<FarmOperation> findByFarmlandIdOrderByOperationDateDesc(Long farmlandId);
    List<FarmOperation> findByFarmlandIdAndOperationDateBetween(Long farmlandId, LocalDate start, LocalDate end);
}
