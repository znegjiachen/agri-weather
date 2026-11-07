-- 由 V6-V9 数据迁移汇总而成：在 schema.sql 之后执行

-- 作物适宜播种期：作物适配资料卡展示


UPDATE crop_info SET sowing_period = '华南 2-3 月；长江中下游 3 月下旬-4 月上旬；北方 4-5 月' WHERE crop_name = '水稻';
UPDATE crop_info SET sowing_period = '冬小麦 9-10 月；春小麦 3-4 月' WHERE crop_name = '小麦';
UPDATE crop_info SET sowing_period = '春播 4-5 月；夏播 6 月' WHERE crop_name = '玉米';
UPDATE crop_info SET sowing_period = '茶苗定植 2-3 月；扦插 6-7 月' WHERE crop_name = '茶叶';
UPDATE crop_info SET sowing_period = '春播 2-3 月；秋播 7-8 月' WHERE crop_name = '番茄';
UPDATE crop_info SET sowing_period = '春播 3-4 月；秋播 7-8 月' WHERE crop_name = '黄瓜';
UPDATE crop_info SET sowing_period = '定植 3-4 月，秋植 10-11 月' WHERE crop_name = '苹果';
UPDATE crop_info SET sowing_period = '定植 3-4 月；扦插 3 月' WHERE crop_name = '葡萄';
UPDATE crop_info SET sowing_period = '春播 4-5 月；夏播 6 月' WHERE crop_name = '大豆';
UPDATE crop_info SET sowing_period = '春播 4-5 月；夏播 6 月' WHERE crop_name = '花生';
UPDATE crop_info SET sowing_period = '冬油菜 9-10 月；春油菜 4 月' WHERE crop_name = '油菜';
UPDATE crop_info SET sowing_period = '4 月中下旬' WHERE crop_name = '棉花';
UPDATE crop_info SET sowing_period = '春播 2-3 月；秋播 8-9 月；北方 4-5 月' WHERE crop_name = '马铃薯';
UPDATE crop_info SET sowing_period = '春薯 4-5 月；夏薯 6 月' WHERE crop_name = '甘薯';
UPDATE crop_info SET sowing_period = '4-5 月' WHERE crop_name = '高粱';
UPDATE crop_info SET sowing_period = '春谷 4-5 月；夏谷 6 月' WHERE crop_name = '谷子';
UPDATE crop_info SET sowing_period = '冬大麦 9-10 月；春大麦 3-4 月' WHERE crop_name = '大麦';
UPDATE crop_info SET sowing_period = '春植 2-3 月；秋植 8-9 月' WHERE crop_name = '甘蔗';
UPDATE crop_info SET sowing_period = '春播 2-3 月；秋播 7 月' WHERE crop_name = '辣椒';
UPDATE crop_info SET sowing_period = '春播 2-3 月；秋播 7 月' WHERE crop_name = '茄子';
UPDATE crop_info SET sowing_period = '秋播 8-9 月；春播 3-4 月' WHERE crop_name = '大白菜';
UPDATE crop_info SET sowing_period = '秋播 8-9 月；春播 3-4 月' WHERE crop_name = '萝卜';
UPDATE crop_info SET sowing_period = '春播 3-4 月；秋播 7-8 月' WHERE crop_name = '胡萝卜';
UPDATE crop_info SET sowing_period = '春播 3-4 月；秋播 9-10 月' WHERE crop_name = '菠菜';
UPDATE crop_info SET sowing_period = '春播 2-3 月；秋播 8-9 月' WHERE crop_name = '生菜';
UPDATE crop_info SET sowing_period = '秋播 9-10 月；春播 3 月' WHERE crop_name = '大蒜';
UPDATE crop_info SET sowing_period = '育苗 2-3 月，定植 3-4 月' WHERE crop_name = '西瓜';
UPDATE crop_info SET sowing_period = '定植 9-10 月' WHERE crop_name = '草莓';
UPDATE crop_info SET sowing_period = '定植 2-3 月，秋植 10 月' WHERE crop_name = '柑橘';
UPDATE crop_info SET sowing_period = '定植 3 月，秋植 10-11 月' WHERE crop_name = '梨';
UPDATE crop_info SET sowing_period = '定植 3 月，秋植 10-11 月' WHERE crop_name = '桃';
UPDATE crop_info SET sowing_period = '春植 2-4 月；秋植 8-10 月' WHERE crop_name = '香蕉';
UPDATE crop_info SET sowing_period = '5-6 月' WHERE crop_name = '绿豆';
UPDATE crop_info SET sowing_period = '秋播 10-11 月；春播 2-3 月' WHERE crop_name = '豌豆';

-- 适宜播种日均温区间：温度评分参考 QX/T 734—2024《关键农时气象服务通则》表 A.1
-- 标准未列出的作物，按作物播种/定植的常用温度区间取值


UPDATE crop_info SET sowing_temp_min = 12, sowing_temp_max = 30 WHERE crop_name = '水稻';
UPDATE crop_info SET sowing_temp_min = 10, sowing_temp_max = 18 WHERE crop_name = '小麦';
UPDATE crop_info SET sowing_temp_min = 8,  sowing_temp_max = 25 WHERE crop_name = '玉米';
UPDATE crop_info SET sowing_temp_min = 10, sowing_temp_max = 25 WHERE crop_name = '茶叶';
UPDATE crop_info SET sowing_temp_min = 15, sowing_temp_max = 28 WHERE crop_name = '番茄';
UPDATE crop_info SET sowing_temp_min = 15, sowing_temp_max = 30 WHERE crop_name = '黄瓜';
UPDATE crop_info SET sowing_temp_min = 5,  sowing_temp_max = 20 WHERE crop_name = '苹果';
UPDATE crop_info SET sowing_temp_min = 10, sowing_temp_max = 25 WHERE crop_name = '葡萄';
UPDATE crop_info SET sowing_temp_min = 8,  sowing_temp_max = 25 WHERE crop_name = '大豆';
UPDATE crop_info SET sowing_temp_min = 15, sowing_temp_max = 30 WHERE crop_name = '花生';
UPDATE crop_info SET sowing_temp_min = 12, sowing_temp_max = 20 WHERE crop_name = '油菜';
UPDATE crop_info SET sowing_temp_min = 12, sowing_temp_max = 30 WHERE crop_name = '棉花';
UPDATE crop_info SET sowing_temp_min = 6,  sowing_temp_max = 22 WHERE crop_name = '马铃薯';
UPDATE crop_info SET sowing_temp_min = 15, sowing_temp_max = 30 WHERE crop_name = '甘薯';
UPDATE crop_info SET sowing_temp_min = 10, sowing_temp_max = 30 WHERE crop_name = '高粱';
UPDATE crop_info SET sowing_temp_min = 10, sowing_temp_max = 28 WHERE crop_name = '谷子';
UPDATE crop_info SET sowing_temp_min = 5,  sowing_temp_max = 20 WHERE crop_name = '大麦';
UPDATE crop_info SET sowing_temp_min = 15, sowing_temp_max = 32 WHERE crop_name = '甘蔗';
UPDATE crop_info SET sowing_temp_min = 15, sowing_temp_max = 30 WHERE crop_name = '辣椒';
UPDATE crop_info SET sowing_temp_min = 15, sowing_temp_max = 30 WHERE crop_name = '茄子';
UPDATE crop_info SET sowing_temp_min = 10, sowing_temp_max = 25 WHERE crop_name = '大白菜';
UPDATE crop_info SET sowing_temp_min = 8,  sowing_temp_max = 22 WHERE crop_name = '萝卜';
UPDATE crop_info SET sowing_temp_min = 8,  sowing_temp_max = 25 WHERE crop_name = '胡萝卜';
UPDATE crop_info SET sowing_temp_min = 5,  sowing_temp_max = 22 WHERE crop_name = '菠菜';
UPDATE crop_info SET sowing_temp_min = 8,  sowing_temp_max = 24 WHERE crop_name = '生菜';
UPDATE crop_info SET sowing_temp_min = 5,  sowing_temp_max = 22 WHERE crop_name = '大蒜';
UPDATE crop_info SET sowing_temp_min = 18, sowing_temp_max = 32 WHERE crop_name = '西瓜';
UPDATE crop_info SET sowing_temp_min = 10, sowing_temp_max = 26 WHERE crop_name = '草莓';
UPDATE crop_info SET sowing_temp_min = 12, sowing_temp_max = 28 WHERE crop_name = '柑橘';
UPDATE crop_info SET sowing_temp_min = 8,  sowing_temp_max = 25 WHERE crop_name = '梨';
UPDATE crop_info SET sowing_temp_min = 8,  sowing_temp_max = 25 WHERE crop_name = '桃';
UPDATE crop_info SET sowing_temp_min = 18, sowing_temp_max = 32 WHERE crop_name = '香蕉';
UPDATE crop_info SET sowing_temp_min = 12, sowing_temp_max = 30 WHERE crop_name = '绿豆';
UPDATE crop_info SET sowing_temp_min = 5,  sowing_temp_max = 22 WHERE crop_name = '豌豆';

-- 最佳播种温度区间：在适宜区间内再区分「边缘」和「最佳」，
-- 采用 FAO EcoCrop 的四断点响应（下限—最佳下限—最佳上限—上限）


UPDATE crop_info SET sowing_temp_optimal_min = 16, sowing_temp_optimal_max = 25 WHERE crop_name = '水稻';
UPDATE crop_info SET sowing_temp_optimal_min = 14, sowing_temp_optimal_max = 18 WHERE crop_name = '小麦';
UPDATE crop_info SET sowing_temp_optimal_min = 12, sowing_temp_optimal_max = 22 WHERE crop_name = '玉米';
UPDATE crop_info SET sowing_temp_optimal_min = 15, sowing_temp_optimal_max = 22 WHERE crop_name = '茶叶';
UPDATE crop_info SET sowing_temp_optimal_min = 18, sowing_temp_optimal_max = 25 WHERE crop_name = '番茄';
UPDATE crop_info SET sowing_temp_optimal_min = 20, sowing_temp_optimal_max = 28 WHERE crop_name = '黄瓜';
UPDATE crop_info SET sowing_temp_optimal_min = 8,  sowing_temp_optimal_max = 15 WHERE crop_name = '苹果';
UPDATE crop_info SET sowing_temp_optimal_min = 12, sowing_temp_optimal_max = 20 WHERE crop_name = '葡萄';
UPDATE crop_info SET sowing_temp_optimal_min = 12, sowing_temp_optimal_max = 22 WHERE crop_name = '大豆';
UPDATE crop_info SET sowing_temp_optimal_min = 18, sowing_temp_optimal_max = 26 WHERE crop_name = '花生';
UPDATE crop_info SET sowing_temp_optimal_min = 15, sowing_temp_optimal_max = 20 WHERE crop_name = '油菜';
UPDATE crop_info SET sowing_temp_optimal_min = 15, sowing_temp_optimal_max = 25 WHERE crop_name = '棉花';
UPDATE crop_info SET sowing_temp_optimal_min = 10, sowing_temp_optimal_max = 18 WHERE crop_name = '马铃薯';
UPDATE crop_info SET sowing_temp_optimal_min = 18, sowing_temp_optimal_max = 26 WHERE crop_name = '甘薯';
UPDATE crop_info SET sowing_temp_optimal_min = 12, sowing_temp_optimal_max = 24 WHERE crop_name = '高粱';
UPDATE crop_info SET sowing_temp_optimal_min = 12, sowing_temp_optimal_max = 24 WHERE crop_name = '谷子';
UPDATE crop_info SET sowing_temp_optimal_min = 8,  sowing_temp_optimal_max = 16 WHERE crop_name = '大麦';
UPDATE crop_info SET sowing_temp_optimal_min = 20, sowing_temp_optimal_max = 30 WHERE crop_name = '甘蔗';
UPDATE crop_info SET sowing_temp_optimal_min = 18, sowing_temp_optimal_max = 28 WHERE crop_name = '辣椒';
UPDATE crop_info SET sowing_temp_optimal_min = 18, sowing_temp_optimal_max = 28 WHERE crop_name = '茄子';
UPDATE crop_info SET sowing_temp_optimal_min = 12, sowing_temp_optimal_max = 22 WHERE crop_name = '大白菜';
UPDATE crop_info SET sowing_temp_optimal_min = 10, sowing_temp_optimal_max = 20 WHERE crop_name = '萝卜';
UPDATE crop_info SET sowing_temp_optimal_min = 10, sowing_temp_optimal_max = 22 WHERE crop_name = '胡萝卜';
UPDATE crop_info SET sowing_temp_optimal_min = 8,  sowing_temp_optimal_max = 18 WHERE crop_name = '菠菜';
UPDATE crop_info SET sowing_temp_optimal_min = 10, sowing_temp_optimal_max = 20 WHERE crop_name = '生菜';
UPDATE crop_info SET sowing_temp_optimal_min = 8,  sowing_temp_optimal_max = 18 WHERE crop_name = '大蒜';
UPDATE crop_info SET sowing_temp_optimal_min = 22, sowing_temp_optimal_max = 30 WHERE crop_name = '西瓜';
UPDATE crop_info SET sowing_temp_optimal_min = 12, sowing_temp_optimal_max = 22 WHERE crop_name = '草莓';
UPDATE crop_info SET sowing_temp_optimal_min = 15, sowing_temp_optimal_max = 25 WHERE crop_name = '柑橘';
UPDATE crop_info SET sowing_temp_optimal_min = 10, sowing_temp_optimal_max = 20 WHERE crop_name = '梨';
UPDATE crop_info SET sowing_temp_optimal_min = 10, sowing_temp_optimal_max = 20 WHERE crop_name = '桃';
UPDATE crop_info SET sowing_temp_optimal_min = 22, sowing_temp_optimal_max = 30 WHERE crop_name = '香蕉';
UPDATE crop_info SET sowing_temp_optimal_min = 15, sowing_temp_optimal_max = 28 WHERE crop_name = '绿豆';
UPDATE crop_info SET sowing_temp_optimal_min = 8,  sowing_temp_optimal_max = 18 WHERE crop_name = '豌豆';

-- 扩充作物目录：新增 30 种常见蔬菜、粮油、经济作物和果树
-- 未单独维护生长阶段的作物由 CropService.defaultStages 自动生成四阶段
INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    sowing_period, sowing_temp_min, sowing_temp_optimal_min, sowing_temp_optimal_max, sowing_temp_max,
    frost_sensitive, heat_sensitive, waterlog_sensitive) VALUES
('芹菜', '本芹', 100, 15, 25, 60, 85, 450, 8,
 '春播 2-3 月；秋播 7-8 月', 10, 15, 22, 25, TRUE, TRUE, TRUE),
('韭菜', '宽叶韭菜', 120, 12, 25, 55, 80, 450, 8,
 '春播 3-4 月；秋播 8-9 月', 8, 12, 24, 26, TRUE, TRUE, TRUE),
('洋葱', '紫皮洋葱', 150, 10, 25, 55, 80, 450, 8,
 '秋播 8-9 月；春播 3 月', 5, 10, 18, 22, TRUE, TRUE, TRUE),
('花椰菜', '松花菜', 110, 15, 25, 60, 85, 500, 8,
 '春播 3-4 月；秋播 7-8 月', 10, 15, 22, 25, TRUE, TRUE, TRUE),
('西兰花', '青花菜', 100, 15, 25, 60, 85, 500, 8,
 '春播 2-3 月；秋播 7-8 月', 10, 15, 22, 25, TRUE, TRUE, TRUE),
('南瓜', '贝贝南瓜', 110, 18, 30, 55, 80, 500, 9,
 '春播 3-4 月；秋播 7 月', 12, 18, 26, 30, TRUE, TRUE, TRUE),
('冬瓜', '黑皮冬瓜', 130, 20, 32, 55, 80, 600, 9,
 '春播 2-3 月；秋播 7 月', 15, 20, 28, 32, FALSE, TRUE, TRUE),
('丝瓜', '肉丝瓜', 110, 20, 32, 60, 85, 600, 9,
 '春播 3-4 月；秋播 7 月', 15, 20, 28, 32, FALSE, TRUE, TRUE),
('苦瓜', '大顶苦瓜', 120, 20, 32, 60, 85, 600, 9,
 '春播 3-4 月；秋播 7 月', 15, 20, 28, 32, FALSE, TRUE, TRUE),
('豇豆', '长豇豆', 90, 20, 32, 55, 80, 500, 9,
 '春播 4-5 月；秋播 7 月', 12, 18, 28, 32, FALSE, TRUE, TRUE),
('菜豆', '四季豆', 85, 15, 28, 55, 80, 450, 8,
 '春播 3-4 月；秋播 7-8 月', 10, 15, 25, 28, TRUE, TRUE, TRUE),
('蚕豆', '大粒蚕豆', 180, 10, 25, 55, 80, 500, 8,
 '秋播 10-11 月；春播 3 月', 5, 10, 18, 22, TRUE, TRUE, TRUE),
('山药', '铁棍山药', 180, 20, 30, 55, 80, 600, 8,
 '春播 3-4 月', 12, 18, 26, 28, TRUE, TRUE, TRUE),
('芋头', '荔浦芋', 180, 20, 30, 60, 85, 700, 8,
 '春播 2-3 月', 12, 18, 26, 28, TRUE, TRUE, TRUE),
('生姜', '小黄姜', 180, 20, 30, 60, 85, 700, 8,
 '春播 3-4 月', 15, 20, 26, 28, TRUE, TRUE, TRUE),
('莲藕', '鄂莲系列', 180, 20, 30, 65, 90, 900, 8,
 '春植 3-4 月', 12, 18, 26, 28, TRUE, TRUE, TRUE),
('秋葵', '五角秋葵', 100, 20, 32, 55, 80, 500, 9,
 '春播 3-4 月；夏播 5-6 月', 15, 20, 28, 32, FALSE, TRUE, TRUE),
('荞麦', '甜荞', 75, 15, 28, 55, 80, 400, 8,
 '春播 4 月；秋播 7-8 月', 10, 15, 25, 28, TRUE, TRUE, TRUE),
('燕麦', '皮燕麦', 100, 10, 25, 55, 80, 450, 8,
 '春播 3-4 月；秋播 9-10 月', 5, 10, 18, 22, TRUE, TRUE, FALSE),
('芝麻', '白芝麻', 95, 20, 32, 55, 80, 450, 9,
 '春播 4-5 月；夏播 6 月', 15, 20, 28, 32, TRUE, TRUE, TRUE),
('向日葵', '油葵', 110, 18, 30, 50, 75, 450, 9,
 '春播 3-4 月；夏播 6 月', 10, 15, 25, 30, TRUE, TRUE, TRUE),
('烟草', '烤烟', 120, 18, 28, 55, 80, 500, 8,
 '春播 2-3 月（育苗）', 12, 18, 25, 28, TRUE, TRUE, TRUE),
('猕猴桃', '徐香', 240, 12, 28, 60, 85, 800, 8,
 '定植 2-3 月；秋植 10-11 月', 8, 12, 24, 28, TRUE, FALSE, TRUE),
('蓝莓', '蓝丰', 240, 10, 25, 55, 80, 700, 8,
 '定植 2-3 月；秋植 10-11 月', 5, 10, 20, 25, TRUE, FALSE, TRUE),
('芒果', '台农一号', 300, 20, 32, 60, 85, 1000, 9,
 '春植 3-4 月；秋植 8-9 月', 18, 22, 30, 32, FALSE, TRUE, TRUE),
('荔枝', '妃子笑', 300, 20, 32, 60, 85, 1200, 9,
 '春植 2-3 月；秋植 9-10 月', 15, 20, 28, 32, FALSE, TRUE, TRUE),
('菠萝', '巴厘', 300, 20, 32, 60, 85, 1100, 9,
 '春植 3-4 月；秋植 8-9 月', 18, 22, 30, 32, FALSE, TRUE, TRUE),
('火龙果', '红心火龙果', 300, 20, 32, 55, 80, 800, 9,
 '春植 3-4 月；秋植 9-10 月', 18, 22, 30, 32, FALSE, TRUE, TRUE),
('柚子', '沙田柚', 300, 15, 30, 60, 85, 900, 8,
 '定植 2-3 月；秋植 10 月', 12, 15, 25, 30, TRUE, TRUE, TRUE),
('枣', '冬枣', 220, 12, 30, 50, 75, 600, 8,
 '定植 3-4 月；秋植 10-11 月', 8, 12, 25, 30, TRUE, TRUE, TRUE);

-- 数据来源与置信度（V10）：让作物参数可追溯
UPDATE crop_info
SET data_source = 'QX/T 734—2024（播种温度参考）+ FAO EcoCrop + 公开农技资料',
    confidence = 'MEDIUM'
WHERE data_source IS NULL;

UPDATE crop_info
SET data_source = '公开农技资料与地方栽培指南（团队整理，未逐条对照国标）',
    confidence = 'LOW'
WHERE crop_name IN (
    '芹菜', '韭菜', '洋葱', '花椰菜', '西兰花', '南瓜', '冬瓜', '丝瓜', '苦瓜', '豇豆',
    '菜豆', '蚕豆', '山药', '芋头', '生姜', '莲藕', '秋葵', '荞麦', '燕麦', '芝麻',
    '向日葵', '烟草', '猕猴桃', '蓝莓', '芒果', '荔枝', '菠萝', '火龙果', '柚子', '枣'
);
