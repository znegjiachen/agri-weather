package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户在对话里上传的文档。
 *
 * 只用于本轮/近期对话检索，不进入知识库；过期后由定时任务清理。
 */
@Entity
@Table(name = "agent_document")
@Data
@NoArgsConstructor
public class AgentDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 255)
    private String filename;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Column(name = "char_count")
    private Integer charCount;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String content;

    @Column(name = "chunk_count")
    private Integer chunkCount;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;
}