package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** 用户对助农手回答的显式反馈，用于评测与迭代 */
@Entity
@Table(name = "agent_feedback")
@Data
@NoArgsConstructor
public class AgentFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    @Column(name = "message_id")
    private Long messageId;

    /** UP / DOWN */
    @Column(nullable = false, length = 10)
    private String rating;

    @Column(length = 500)
    private String comment;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}