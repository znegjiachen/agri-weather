-- =============================================
-- 扩充作物库 2026-10-26
-- 新增 26 种常见作物；没有单独维护阶段的数据由后端生成通用四阶段。
-- 可重复执行：只有不存在同名作物时才插入。
-- =============================================

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '大豆', '春大豆', 120, 15, 30, 55, 80, 550, 8, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '大豆');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '花生', '鲁花系列', 130, 20, 32, 50, 75, 600, 8, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '花生');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '油菜', '冬油菜', 210, 5, 25, 60, 85, 700, 7, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '油菜');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '棉花', '抗虫棉', 180, 18, 35, 50, 75, 600, 9, FALSE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '棉花');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '马铃薯', '脱毒种薯', 100, 10, 25, 60, 85, 450, 7, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '马铃薯');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '甘薯', '淀粉型', 150, 20, 32, 55, 80, 500, 8, FALSE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '甘薯');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '高粱', '酿造高粱', 120, 18, 32, 50, 75, 450, 9, FALSE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '高粱');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '谷子', '优质小米', 110, 15, 30, 45, 70, 400, 9, TRUE, TRUE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '谷子');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '大麦', '啤酒大麦', 170, 5, 22, 50, 75, 450, 8, TRUE, TRUE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '大麦');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '甘蔗', '糖蔗', 330, 20, 35, 65, 90, 1200, 9, FALSE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '甘蔗');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '辣椒', '线椒', 120, 18, 30, 55, 80, 450, 9, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '辣椒');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '茄子', '紫长茄', 110, 20, 32, 60, 80, 500, 9, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '茄子');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '大白菜', '秋播白菜', 80, 10, 25, 60, 85, 450, 7, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '大白菜');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '萝卜', '白萝卜', 90, 10, 25, 55, 80, 400, 7, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '萝卜');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '胡萝卜', '三红胡萝卜', 110, 12, 28, 55, 80, 400, 8, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '胡萝卜');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '菠菜', '圆叶菠菜', 50, 5, 25, 55, 80, 300, 7, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '菠菜');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '生菜', '结球生菜', 55, 8, 24, 60, 85, 300, 7, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '生菜');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '大蒜', '紫皮蒜', 200, 5, 24, 55, 80, 400, 8, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '大蒜');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '西瓜', '麒麟瓜', 95, 20, 35, 50, 75, 450, 9, FALSE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '西瓜');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '草莓', '红颜', 150, 10, 26, 55, 80, 400, 8, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '草莓');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '柑橘', '砂糖橘', 300, 12, 30, 60, 85, 800, 8, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '柑橘');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '梨', '翠冠梨', 220, 8, 30, 50, 75, 600, 8, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '梨');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '桃', '水蜜桃', 180, 10, 30, 50, 75, 550, 8, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '桃');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '香蕉', '巴西蕉', 300, 20, 32, 65, 90, 1200, 9, FALSE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '香蕉');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '绿豆', '明绿豆', 80, 15, 32, 50, 75, 350, 8, FALSE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '绿豆');

INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive)
SELECT '豌豆', '中豌', 100, 5, 25, 55, 80, 400, 7, TRUE, TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM crop_info WHERE crop_name = '豌豆');