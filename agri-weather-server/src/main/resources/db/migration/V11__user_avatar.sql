ALTER TABLE sys_user
    ADD COLUMN avatar VARCHAR(255) NULL COMMENT '头像：本站图片 URL 或 emoji' AFTER region;
