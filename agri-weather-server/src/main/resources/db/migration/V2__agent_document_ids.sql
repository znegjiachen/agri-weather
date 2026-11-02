-- 多文档引用：记录本轮引用的全部文档 ID
ALTER TABLE agent_chat_message
    ADD COLUMN document_ids VARCHAR(500) NULL COMMENT '本轮引用的文档 ID CSV' AFTER document_id;
