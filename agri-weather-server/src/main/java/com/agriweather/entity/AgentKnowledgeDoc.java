package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** 智能体知识库文档：只存提取后的纯文本，原始文件不入库 */
@Entity
@Table(name = "agent_knowledge_doc")
@Data
@NoArgsConstructor
public class AgentKnowledgeDoc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agent_id", nullable = false)
    private Long agentId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 200)
    private String title;

    /** TEXT / FILE */
    @Column(name = "source_type", nullable = false, length = 20)
    private String sourceType;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Column(name = "byte_size")
    private Integer byteSize;

    @Column(name = "char_count")
    private Integer charCount;

    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    private String content;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}