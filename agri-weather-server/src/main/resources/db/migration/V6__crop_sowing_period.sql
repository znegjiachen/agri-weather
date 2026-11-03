-- 作物适宜播种期：作物适配资料卡展示
ALTER TABLE crop_info
    ADD COLUMN sowing_period VARCHAR(120) NULL COMMENT '适宜播种期（按主要产区概括）' AFTER suitable_light_hours;

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
