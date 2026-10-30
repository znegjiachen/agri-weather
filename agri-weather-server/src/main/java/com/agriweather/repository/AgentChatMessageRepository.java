package com.agriweather.repository;

import com.agriweather.entity.AgentChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AgentChatMessageRepository extends JpaRepository<AgentChatMessage, Long> {

    List<AgentChatMessage> findByAgentIdAndUserIdOrderByIdDesc(Long agentId, Long userId, Pageable pageable);

    @Modifying
    @Query("delete from AgentChatMessage m where m.agentId = :agentId and m.userId = :userId")
    int deleteByAgentIdAndUserId(@Param("agentId") Long agentId, @Param("userId") Long userId);

    @Modifying
    @Query("delete from AgentChatMessage m where m.agentId = :agentId")
    int deleteByAgentId(@Param("agentId") Long agentId);
}