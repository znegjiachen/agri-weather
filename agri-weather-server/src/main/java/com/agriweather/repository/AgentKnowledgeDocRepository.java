package com.agriweather.repository;

import com.agriweather.entity.AgentKnowledgeDoc;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AgentKnowledgeDocRepository extends JpaRepository<AgentKnowledgeDoc, Long> {

    List<AgentKnowledgeDoc> findByAgentIdOrderByIdDesc(Long agentId);

    Optional<AgentKnowledgeDoc> findByIdAndAgentId(Long id, Long agentId);

    long countByAgentId(Long agentId);

    @Modifying
    @Query("delete from AgentKnowledgeDoc d where d.agentId = :agentId")
    int deleteByAgentId(@Param("agentId") Long agentId);

    @Query("""
            select d.agentId as agentId, count(d) as total
            from AgentKnowledgeDoc d
            where d.agentId in :agentIds
            group by d.agentId
            """)
    List<AgentCount> countByAgentIds(@Param("agentIds") Collection<Long> agentIds);

    interface AgentCount {
        Long getAgentId();

        long getTotal();
    }
}