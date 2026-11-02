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

    /** 用户本轮上传的文档 ID / 名称 / 旧版正文 */
    @Column(name = "document_id")
    private Long documentId;

    /** 多文档引用：逗号分隔的文档 ID */
    @Column(name = "document_ids", length = 500)
    private String documentIds;

    @Column(name = "document_name", length = 255)
    private String documentName;

    @Column(name = "document_context", columnDefinition = "MEDIUMTEXT")
    private String documentContext;

    @Column(name = "tool_calls", columnDefinition = "MEDIUMTEXT")
    private String toolCalls;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String thoughts;

    @Column(name = "knowledge_used", columnDefinition = "MEDIUMTEXT")
    private String knowledgeUsed;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}