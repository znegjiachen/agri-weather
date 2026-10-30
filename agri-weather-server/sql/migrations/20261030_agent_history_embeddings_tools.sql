-- =============================================
-- 智能体：工具开关 + 向量检索 + 对话历史 2026-10-30
-- 生产环境 ddl-auto=validate，部署前先执行本脚本：
--   mysql -u ... -p agri_weather < 20261030_agent_history_embeddings_tools.sql
-- =============================================

ALTER TABLE farmland_agent
  ADD COLUMN enabled_tools VARCHAR(500) NULL COMMENT '逗号分隔的工具名，空表示全部启用';

ALTER TABLE agent_knowledge_chunk
  ADD COLUMN embedding MEDIUMBLOB NULL COMMENT 'float32 向量，小端序',
  ADD COLUMN embedding_dim INT NULL,
  ADD COLUMN embedding_model VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS agent_chat_message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    agent_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content MEDIUMTEXT,
    vision MEDIUMTEXT COMMENT '图片识别结果 JSON',
    tool_calls MEDIUMTEXT COMMENT '工具调用轨迹 JSON',
    thoughts MEDIUMTEXT COMMENT '模型思考 JSON',
    knowledge_used MEDIUMTEXT COMMENT '引用知识 JSON',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_msg_agent (agent_id, id),
    KEY idx_msg_user (user_id),
    CONSTRAINT fk_msg_agent FOREIGN KEY (agent_id) REFERENCES farmland_agent(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_user FOREIGN KEY (user_id) REFERENCES sys_user(id)
) ENGINE=InnoDB COMMENT='智能体对话历史';