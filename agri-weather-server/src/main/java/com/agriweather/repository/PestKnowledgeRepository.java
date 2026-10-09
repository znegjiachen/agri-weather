package com.agriweather.repository;

import com.agriweather.entity.PestKnowledge;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PestKnowledgeRepository extends JpaRepository<PestKnowledge, Long> {
    List<PestKnowledge> findByPestType(String pestType);
    List<PestKnowledge> findByHighRiskStagesContaining(String stageName);
}
