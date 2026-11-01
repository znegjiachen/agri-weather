package com.agriweather.repository;

import com.agriweather.entity.AgentDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface AgentDocumentRepository extends JpaRepository<AgentDocument, Long> {

    Optional<AgentDocument> findByIdAndUserId(Long id, Long userId);

    @Modifying
    @Query("delete from AgentDocument d where d.expiresAt < :now")
    int deleteExpired(@Param("now") LocalDateTime now);
}