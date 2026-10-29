package com.agriweather.repository;

import com.agriweather.entity.AgentKnowledgeChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface AgentKnowledgeChunkRepository extends JpaRepository<AgentKnowledgeChunk, Long> {

    List<AgentKnowledgeChunk> findByAgentIdOrderByDocIdAscChunkIndexAsc(Long agentId);

    long countByAgentId(Long agentId);

    @Modifying
    @Query("delete from AgentKnowledgeChunk c where c.agentId = :agentId")
    int deleteByAgentId(@Param("agentId") Long agentId);

    @Modifying
    @Query("delete from AgentKnowledgeChunk c where c.docId = :docId")
    int deleteByDocId(@Param("docId") Long docId);

    @Query("""
            select c.agentId as agentId, count(c) as total
            from AgentKnowledgeChunk c
            where c.agentId in :agentIds
            group by c.agentId
            """)
    List<AgentCount> countByAgentIds(@Param("agentIds") Collection<Long> agentIds);

    interface AgentCount {
        Long getAgentId();

        long getTotal();
    }

    @Query("""
            select c.docId as docId, count(c) as total
            from AgentKnowledgeChunk c
            where c.agentId = :agentId
            group by c.docId
            """)
    List<DocCount> countByDoc(@Param("agentId") Long agentId);

    interface DocCount {
        Long getDocId();

        long getTotal();
    }
}