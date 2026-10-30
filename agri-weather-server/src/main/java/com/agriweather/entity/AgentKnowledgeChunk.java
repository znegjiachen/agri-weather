package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** 知识库检索片段，按文档切块存储 */
@Entity
@Table(name = "agent_knowledge_chunk")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentKnowledgeChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doc_id", nullable = false)
    private Long docId;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** float32 小端序向量；为空表示还没做向量索引 */
    @Lob
    @Column(columnDefinition = "MEDIUMBLOB")
    private byte[] embedding;

    @Column(name = "embedding_dim")
    private Integer embeddingDim;

    @Column(name = "embedding_model", length = 100)
    private String embeddingModel;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public AgentKnowledgeChunk(Long id, Long docId, Long agentId, Integer chunkIndex,
                               String content, LocalDateTime createdAt) {
        this.id = id;
        this.docId = docId;
        this.agentId = agentId;
        this.chunkIndex = chunkIndex;
        this.content = content;
        this.createdAt = createdAt;
    }
}