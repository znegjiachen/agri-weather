package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** 对话文档的检索片段与向量 */
@Entity
@Table(name = "agent_document_chunk")
@Data
@NoArgsConstructor
public class AgentDocumentChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** float32 小端序向量；为空时退化为关键词检索 */
    @Lob
    @Column(columnDefinition = "MEDIUMBLOB")
    private byte[] embedding;

    @Column(name = "embedding_dim")
    private Integer embeddingDim;

    @Column(name = "embedding_model", length = 100)
    private String embeddingModel;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}