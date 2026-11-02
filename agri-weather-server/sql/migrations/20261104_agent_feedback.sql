-- 助农手回答反馈：点赞/点踩，用于 AI 评测与迭代
CREATE TABLE IF NOT EXISTS agent_feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    agent_id BIGINT NOT NULL,
    message_id BIGINT,
    rating VARCHAR(10) NOT NULL COMMENT 'UP / DOWN',
    comment VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_feedback_message_user (message_id, user_id),
    KEY idx_feedback_agent (agent_id),
    CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES sys_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_feedback_agent FOREIGN KEY (agent_id) REFERENCES farmland_agent(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='助农手回答反馈';
