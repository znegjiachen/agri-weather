-- 智能体对话历史：保存用户上传的文档名与正文，刷新/换设备后仍能继续追问
ALTER TABLE agent_chat_message
    ADD COLUMN document_name VARCHAR(255) NULL COMMENT '本轮上传的文档名' AFTER vision,
    ADD COLUMN document_context MEDIUMTEXT NULL COMMENT '本轮上传的文档正文' AFTER document_name;