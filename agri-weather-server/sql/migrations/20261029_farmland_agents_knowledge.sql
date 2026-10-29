-- =============================================
-- 地块专属智能体 + 知识库 2026-10-29
-- 生产环境 ddl-auto=validate，部署前先执行本脚本：
--   mysql -u ... -p agri_weather < 20261029_farmland_agents_knowledge.sql
-- =============================================

CREATE TABLE IF NOT EXISTS farmland_agent (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    farmland_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(16),
    persona MEDIUMTEXT COMMENT '专属人设，拼接到通用农事提示词之后',
    welcome VARCHAR(500) COMMENT '对话页欢迎语',
    persona_custom BOOLEAN NOT NULL DEFAULT FALSE COMMENT '用户改过人设后不再被作物变更覆盖',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_agent_farmland (farmland_id),
    KEY idx_agent_user (user_id),
    CONSTRAINT fk_agent_user FOREIGN KEY (user_id) REFERENCES sys_user(id),
    CONSTRAINT fk_agent_farmland FOREIGN KEY (farmland_id) REFERENCES farmland(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='每块地一个专属助农手';

CREATE TABLE IF NOT EXISTS agent_knowledge_doc (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    source_type VARCHAR(20) NOT NULL COMMENT 'TEXT / FILE',
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),
    byte_size INT,
    char_count INT,
    content MEDIUMTEXT NOT NULL COMMENT '提取后的纯文本，不存原始二进制',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_doc_agent (agent_id),
    CONSTRAINT fk_doc_agent FOREIGN KEY (agent_id) REFERENCES farmland_agent(id) ON DELETE CASCADE,
    CONSTRAINT fk_doc_user FOREIGN KEY (user_id) REFERENCES sys_user(id)
) ENGINE=InnoDB COMMENT='智能体自定义知识库文档';

CREATE TABLE IF NOT EXISTS agent_knowledge_chunk (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    doc_id BIGINT NOT NULL,
    agent_id BIGINT NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_chunk_agent (agent_id),
    KEY idx_chunk_doc (doc_id),
    CONSTRAINT fk_chunk_doc FOREIGN KEY (doc_id) REFERENCES agent_knowledge_doc(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='知识库检索片段';