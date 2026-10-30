package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** 智能体对话历史。一个智能体一条连续会话，按 id 排序。 */
@Entity
@Table(name = "agent_chat_message")
@Data
@NoArgsConstructor
public class AgentChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    /** user / assistant */
    @Column(nullable = false, length = 20)
    private String role;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String content;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String vision;

    @Column(name = "tool_calls", columnDefinition = "MEDIUMTEXT")
    private String toolCalls;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String thoughts;

    @Column(name = "knowledge_used", columnDefinition = "MEDIUMTEXT")
    private String knowledgeUsed;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}