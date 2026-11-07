-- 作物数据来源与置信度：让每条作物记录能回答「数据依据是什么」
ALTER TABLE crop_info
    ADD COLUMN data_source VARCHAR(200) NULL COMMENT '数据来源与依据' AFTER waterlog_sensitive,
    ADD COLUMN confidence VARCHAR(10) NULL COMMENT '置信度：HIGH/MEDIUM/LOW' AFTER data_source;

-- 初始 34 种作物：播种温度参考 QX/T 734—2024，生育参数综合 FAO EcoCrop 与公开农技资料
UPDATE crop_info
SET data_source = 'QX/T 734—2024（播种温度参考）+ FAO EcoCrop + 公开农技资料',
    confidence = 'MEDIUM'
WHERE data_source IS NULL;

-- 后续扩充的 30 种作物：团队整理的公开农技资料与地方栽培指南，尚未逐条对照国标
UPDATE crop_info
SET data_source = '公开农技资料与地方栽培指南（团队整理，未逐条对照国标）',
    confidence = 'LOW'
WHERE crop_name IN (
    '芹菜', '韭菜', '洋葱', '花椰菜', '西兰花', '南瓜', '冬瓜', '丝瓜', '苦瓜', '豇豆',
    '菜豆', '蚕豆', '山药', '芋头', '生姜', '莲藕', '秋葵', '荞麦', '燕麦', '芝麻',
    '向日葵', '烟草', '猕猴桃', '蓝莓', '芒果', '荔枝', '菠萝', '火龙果', '柚子', '枣'
);
