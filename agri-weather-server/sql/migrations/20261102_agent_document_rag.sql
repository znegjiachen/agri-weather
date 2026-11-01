-- 对话文档检索：上传时切块建索引，对话时按问题注入相关片段
ALTER TABLE agent_chat_message
    ADD COLUMN document_id BIGINT NULL COMMENT '本轮上传的对话文档 ID' AFTER vision;

CREATE TABLE IF NOT EXISTS agent_document (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    char_count INT,
    content MEDIUMTEXT,
    chunk_count INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    KEY idx_doc_user (user_id),
    KEY idx_doc_expires (expires_at),
    CONSTRAINT fk_doc_user FOREIGN KEY (user_id) REFERENCES sys_user(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='对话内上传的文档';

CREATE TABLE IF NOT EXISTS agent_document_chunk (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding MEDIUMBLOB COMMENT 'float32 小端序向量',
    embedding_dim INT,
    embedding_model VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_doc_chunk (document_id, chunk_index),
    CONSTRAINT fk_doc_chunk_doc FOREIGN KEY (document_id) REFERENCES agent_document(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='对话文档检索片段';