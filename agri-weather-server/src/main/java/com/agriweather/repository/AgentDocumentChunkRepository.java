package com.agriweather.repository;

import com.agriweather.entity.AgentDocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AgentDocumentChunkRepository extends JpaRepository<AgentDocumentChunk, Long> {

    List<AgentDocumentChunk> findByDocumentIdOrderByChunkIndexAsc(Long documentId);

    long countByDocumentId(Long documentId);

    @Modifying
    @Query("delete from AgentDocumentChunk c where c.documentId in "
            + "(select d.id from AgentDocument d where d.expiresAt < :now)")
    int deleteExpired(@Param("now") LocalDateTime now);
}