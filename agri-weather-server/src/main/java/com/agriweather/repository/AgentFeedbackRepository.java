package com.agriweather.repository;

import com.agriweather.entity.AgentFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AgentFeedbackRepository extends JpaRepository<AgentFeedback, Long> {

    long countByRating(String rating);

    Optional<AgentFeedback> findFirstByMessageIdAndUserId(Long messageId, Long userId);
}