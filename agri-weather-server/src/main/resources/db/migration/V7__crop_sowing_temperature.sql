-- 适宜播种日均温区间：温度评分参考 QX/T 734—2024《关键农时气象服务通则》表 A.1
-- 标准未列出的作物，按作物播种/定植的常用温度区间取值
ALTER TABLE crop_info
    ADD COLUMN sowing_temp_min DOUBLE NULL COMMENT '适宜播种日平均气温下限（℃）' AFTER sowing_period,
    ADD COLUMN sowing_temp_max DOUBLE NULL COMMENT '适宜播种日平均气温上限（℃）' AFTER sowing_temp_min;

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
