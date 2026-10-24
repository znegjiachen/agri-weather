-- =============================================
-- 地块边界（地图圈地）2026-10-24
-- 生产环境 ddl-auto=validate，部署前先执行本脚本：
--   mysql -u ... -p agri_weather < 20261024_farmland_boundary.sql
-- =============================================

ALTER TABLE farmland
  ADD COLUMN boundary MEDIUMTEXT NULL COMMENT '地块边界 JSON [{lat,lng}]，WGS84';