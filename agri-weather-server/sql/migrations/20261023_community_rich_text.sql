-- =============================================
-- 社区富文本 + 图片上传（2026-10-23）
--
-- 生产环境 ddl-auto=validate，部署新代码前必须先执行本脚本：
--   mysql -u ... -p agri_weather < 20261023_community_rich_text.sql
-- 本地开发（ddl-auto=update）也需要手动执行，Hibernate 不会自动放宽列类型。
-- =============================================

-- 1. 正文放宽：富文本 HTML 远超 VARCHAR(2000)
ALTER TABLE community_post
  MODIFY content MEDIUMTEXT NOT NULL COMMENT 'TEXT 为纯文本，HTML 为净化后的富文本';

-- 2. 显式区分老帖子（纯文本）与新帖子（HTML），避免历史数据被当成标签渲染
ALTER TABLE community_post
  ADD COLUMN content_format VARCHAR(10) NOT NULL DEFAULT 'TEXT' COMMENT 'TEXT/HTML';

-- 3. 图片表：二进制存库，多实例共享
CREATE TABLE IF NOT EXISTS community_image (
  id         BIGINT        NOT NULL AUTO_INCREMENT,
  public_id  CHAR(32)      NOT NULL COMMENT '对外 URL 标识（随机，避免枚举）',
  user_id    BIGINT        NOT NULL COMMENT '上传者',
  post_id    BIGINT        DEFAULT NULL COMMENT '挂接的帖子，NULL 表示尚未发布',
  mime_type  VARCHAR(40)   NOT NULL,
  byte_size  INT           NOT NULL,
  width      INT           NOT NULL,
  height     INT           NOT NULL,
  data       LONGBLOB      NOT NULL,
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_image_public_id (public_id),
  KEY idx_image_user (user_id),
  KEY idx_image_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;