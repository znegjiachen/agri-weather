-- =============================================
-- 问田 — 完整建表 + 初始数据
-- =============================================

CREATE DATABASE IF NOT EXISTS agri_weather
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE agri_weather;

-- =============================================
-- 1. 用户表
-- =============================================
CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'FARMER',
    phone VARCHAR(20),
    region VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- 2. 农作物信息表
-- =============================================
CREATE TABLE IF NOT EXISTS crop_info (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    crop_name VARCHAR(50) NOT NULL,
    variety VARCHAR(50),
    growth_cycle_days INT,
    suitable_temp_min DOUBLE,
    suitable_temp_max DOUBLE,
    suitable_humidity_min DOUBLE,
    suitable_humidity_max DOUBLE,
    suitable_rainfall DOUBLE,
    suitable_light_hours DOUBLE,
    frost_sensitive BOOLEAN DEFAULT FALSE,
    heat_sensitive BOOLEAN DEFAULT FALSE,
    waterlog_sensitive BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB;

-- =============================================
-- 3. 作物生长阶段表
-- =============================================
CREATE TABLE IF NOT EXISTS crop_growth_stage (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    crop_id BIGINT NOT NULL,
    stage_name VARCHAR(30) NOT NULL,
    stage_order INT,
    stage_days INT,
    temp_min DOUBLE,
    temp_max DOUBLE,
    humidity_min DOUBLE,
    humidity_max DOUBLE,
    rainfall_need DOUBLE,
    light_need DOUBLE,
    pest_risk_level VARCHAR(10),
    key_warnings VARCHAR(500),
    FOREIGN KEY (crop_id) REFERENCES crop_info(id)
) ENGINE=InnoDB;

-- =============================================
-- 4. 农户地块表
-- =============================================
CREATE TABLE IF NOT EXISTS farmland (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    altitude DOUBLE,
    area_mu DOUBLE,
    soil_type VARCHAR(30),
    crop_id BIGINT,
    plant_date DATE,
    irrigation_type VARCHAR(20),
    boundary MEDIUMTEXT COMMENT '地块边界 JSON [{lat,lng}]，WGS84',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES sys_user(id),
    FOREIGN KEY (crop_id) REFERENCES crop_info(id)
) ENGINE=InnoDB;

-- =============================================
-- 5. 病虫害知识库
-- =============================================
CREATE TABLE IF NOT EXISTS pest_knowledge (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pest_name VARCHAR(50) NOT NULL,
    pest_type VARCHAR(20),
    trigger_temp_min DOUBLE,
    trigger_temp_max DOUBLE,
    trigger_humidity_min DOUBLE,
    trigger_humidity_max DOUBLE,
    trigger_rain_days INT,
    high_risk_stages VARCHAR(200),
    prevention VARCHAR(500),
    control_method VARCHAR(500),
    recommended_pesticide VARCHAR(300)
) ENGINE=InnoDB;

-- =============================================
-- 6. 气象预警记录表
-- =============================================
CREATE TABLE IF NOT EXISTS weather_alert (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    farmland_id BIGINT,
    alert_type VARCHAR(30),
    alert_level VARCHAR(10),
    alert_content VARCHAR(500),
    suggestion VARCHAR(500),
    alert_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    is_handled BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES sys_user(id),
    FOREIGN KEY (farmland_id) REFERENCES farmland(id)
) ENGINE=InnoDB;

-- =============================================
-- 7. 农事作业记录表
-- =============================================
CREATE TABLE IF NOT EXISTS farm_operation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    farmland_id BIGINT NOT NULL,
    operation_type VARCHAR(20),
    operation_date DATE,
    weather_condition VARCHAR(100),
    detail VARCHAR(500),
    fertilizer VARCHAR(100),
    pesticide VARCHAR(100),
    operator VARCHAR(50),
    notes VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (farmland_id) REFERENCES farmland(id)
) ENGINE=InnoDB;

-- =============================================
-- 8. 二十四节气农事指南表
-- =============================================
CREATE TABLE IF NOT EXISTS solar_term_guide (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    term_name VARCHAR(20) NOT NULL,
    term_date_range VARCHAR(30),
    crop_stages VARCHAR(500),
    farm_tasks VARCHAR(1000),
    pest_risks VARCHAR(500),
    traditional_tips VARCHAR(1000)
) ENGINE=InnoDB;

-- =============================================
-- ============ 初始数据 ========================
-- =============================================

-- 作物数据
INSERT INTO crop_info (crop_name, variety, growth_cycle_days,
    suitable_temp_min, suitable_temp_max, suitable_humidity_min, suitable_humidity_max,
    suitable_rainfall, suitable_light_hours,
    frost_sensitive, heat_sensitive, waterlog_sensitive) VALUES
('水稻', '常规籼稻', 150, 20, 32, 60, 85, 800, 8, TRUE, TRUE, TRUE),
('小麦', '冬小麦', 230, 10, 25, 50, 75, 500, 8, TRUE, TRUE, FALSE),
('玉米', '杂交玉米', 120, 18, 30, 55, 80, 600, 8, FALSE, TRUE, TRUE),
('茶叶', '绿茶', 365, 15, 28, 65, 85, 1200, 6, TRUE, FALSE, TRUE),
('番茄', '大果番茄', 120, 18, 28, 55, 75, 400, 10, TRUE, TRUE, TRUE),
('黄瓜', '刺黄瓜', 90, 20, 30, 60, 80, 350, 8, TRUE, TRUE, TRUE),
('苹果', '红富士', 365, 15, 26, 50, 70, 600, 8, TRUE, FALSE, FALSE),
('葡萄', '巨峰', 180, 18, 30, 55, 75, 500, 8, FALSE, TRUE, TRUE),
('大豆', '春大豆', 120, 15, 30, 55, 80, 550, 8, TRUE, TRUE, TRUE),
('花生', '鲁花系列', 130, 20, 32, 50, 75, 600, 8, TRUE, TRUE, TRUE),
('油菜', '冬油菜', 210, 5, 25, 60, 85, 700, 7, TRUE, TRUE, TRUE),
('棉花', '抗虫棉', 180, 18, 35, 50, 75, 600, 9, FALSE, TRUE, TRUE),
('马铃薯', '脱毒种薯', 100, 10, 25, 60, 85, 450, 7, TRUE, TRUE, TRUE),
('甘薯', '淀粉型', 150, 20, 32, 55, 80, 500, 8, FALSE, TRUE, TRUE),
('高粱', '酿造高粱', 120, 18, 32, 50, 75, 450, 9, FALSE, TRUE, TRUE),
('谷子', '优质小米', 110, 15, 30, 45, 70, 400, 9, TRUE, TRUE, FALSE),
('大麦', '啤酒大麦', 170, 5, 22, 50, 75, 450, 8, TRUE, TRUE, FALSE),
('甘蔗', '糖蔗', 330, 20, 35, 65, 90, 1200, 9, FALSE, TRUE, TRUE),
('辣椒', '线椒', 120, 18, 30, 55, 80, 450, 9, TRUE, TRUE, TRUE),
('茄子', '紫长茄', 110, 20, 32, 60, 80, 500, 9, TRUE, TRUE, TRUE),
('大白菜', '秋播白菜', 80, 10, 25, 60, 85, 450, 7, TRUE, TRUE, TRUE),
('萝卜', '白萝卜', 90, 10, 25, 55, 80, 400, 7, TRUE, TRUE, TRUE),
('胡萝卜', '三红胡萝卜', 110, 12, 28, 55, 80, 400, 8, TRUE, TRUE, TRUE),
('菠菜', '圆叶菠菜', 50, 5, 25, 55, 80, 300, 7, TRUE, TRUE, TRUE),
('生菜', '结球生菜', 55, 8, 24, 60, 85, 300, 7, TRUE, TRUE, TRUE),
('大蒜', '紫皮蒜', 200, 5, 24, 55, 80, 400, 8, TRUE, TRUE, TRUE),
('西瓜', '麒麟瓜', 95, 20, 35, 50, 75, 450, 9, FALSE, TRUE, TRUE),
('草莓', '红颜', 150, 10, 26, 55, 80, 400, 8, TRUE, TRUE, TRUE),
('柑橘', '砂糖橘', 300, 12, 30, 60, 85, 800, 8, TRUE, TRUE, TRUE),
('梨', '翠冠梨', 220, 8, 30, 50, 75, 600, 8, TRUE, TRUE, TRUE),
('桃', '水蜜桃', 180, 10, 30, 50, 75, 550, 8, TRUE, TRUE, TRUE),
('香蕉', '巴西蕉', 300, 20, 32, 65, 90, 1200, 9, FALSE, TRUE, TRUE),
('绿豆', '明绿豆', 80, 15, 32, 50, 75, 350, 8, FALSE, TRUE, TRUE),
('豌豆', '中豌', 100, 5, 25, 55, 80, 400, 7, TRUE, TRUE, TRUE);

-- 水稻生长阶段
INSERT INTO crop_growth_stage (crop_id, stage_name, stage_order, stage_days,
    temp_min, temp_max, humidity_min, humidity_max, rainfall_need, light_need,
    pest_risk_level, key_warnings) VALUES
(1, '播种育秧期', 1, 25, 12, 30, 60, 80, 50, 6, 'MEDIUM', '低温烂秧；暴雨冲刷秧苗'),
(1, '返青期', 2, 10, 18, 30, 65, 85, 30, 7, 'LOW', '深水护苗，预防低温'),
(1, '分蘖期', 3, 25, 20, 32, 60, 80, 80, 8, 'HIGH', '稻飞虱、螟虫高发；注意晒田控蘖'),
(1, '拔节孕穗期', 4, 30, 22, 32, 65, 85, 120, 8, 'HIGH', '稻瘟病、纹枯病；需充足水分'),
(1, '抽穗扬花期', 5, 15, 22, 30, 60, 80, 60, 8, 'HIGH', '忌暴雨大风；高温不实'),
(1, '灌浆成熟期', 6, 30, 20, 30, 55, 75, 50, 8, 'MEDIUM', '适温灌浆；连阴雨霉变'),
(1, '收获期', 7, 15, 18, 32, 50, 70, 20, 8, 'LOW', '抢晴收获；避免穗发芽');

-- 小麦生长阶段
INSERT INTO crop_growth_stage (crop_id, stage_name, stage_order, stage_days,
    temp_min, temp_max, humidity_min, humidity_max, rainfall_need, light_need,
    pest_risk_level, key_warnings) VALUES
(2, '播种出苗期', 1, 15, 8, 20, 55, 75, 30, 6, 'LOW', '适墒播种；干旱影响出苗'),
(2, '分蘖越冬期', 2, 60, 0, 15, 50, 70, 60, 6, 'LOW', '防冻害；积雪覆盖保温'),
(2, '返青拔节期', 3, 35, 10, 22, 55, 75, 80, 7, 'MEDIUM', '蚜虫、纹枯病；防倒春寒'),
(2, '孕穗抽穗期', 4, 30, 15, 25, 55, 75, 100, 8, 'HIGH', '赤霉病、白粉病；忌连阴雨'),
(2, '灌浆成熟期', 5, 35, 18, 28, 50, 70, 60, 8, 'MEDIUM', '干热风逼熟；防穗发芽'),
(2, '收获期', 6, 15, 18, 32, 45, 65, 20, 8, 'LOW', '抢晴收割；防烂场雨');

-- 玉米生长阶段
INSERT INTO crop_growth_stage (crop_id, stage_name, stage_order, stage_days,
    temp_min, temp_max, humidity_min, humidity_max, rainfall_need, light_need,
    pest_risk_level, key_warnings) VALUES
(3, '播种出苗期', 1, 10, 10, 28, 55, 75, 30, 7, 'LOW', '地温需稳定在10°C以上'),
(3, '苗期', 2, 25, 15, 30, 50, 70, 60, 8, 'MEDIUM', '地下害虫；适当蹲苗抗旱'),
(3, '拔节孕穗期', 3, 30, 20, 30, 60, 80, 120, 8, 'HIGH', '玉米螟、蚜虫；需水肥关键期'),
(3, '抽雄吐丝期', 4, 15, 22, 30, 55, 75, 80, 8, 'HIGH', '高温杀雄；连阴雨授粉不良'),
(3, '灌浆成熟期', 5, 35, 18, 28, 50, 70, 60, 7, 'MEDIUM', '适时晚收；防早霜'),
(3, '收获期', 6, 10, 15, 30, 45, 65, 20, 8, 'LOW', '完熟收获；及时晾晒');

-- 病虫害知识库
INSERT INTO pest_knowledge (pest_name, pest_type, trigger_temp_min, trigger_temp_max,
    trigger_humidity_min, trigger_humidity_max, trigger_rain_days,
    high_risk_stages, prevention, control_method, recommended_pesticide) VALUES
('稻飞虱', 'INSECT', 22, 30, 70, 90, 3, '分蘖期,拔节孕穗期',
 '合理密植，避免过量施氮肥；保护天敌（蜘蛛、寄生蜂）',
 '及时喷洒吡虫啉或噻虫嗪，重点喷施稻株基部',
 '吡虫啉、噻虫嗪、烯啶虫胺'),
('稻瘟病', 'FUNGUS', 20, 28, 75, 95, 5, '拔节孕穗期,抽穗扬花期',
 '选用抗病品种；合理施肥，避免偏施氮肥',
 '发病初期喷洒三环唑或稻瘟灵，穗期重点防治穗颈瘟',
 '三环唑、稻瘟灵、春雷霉素'),
('小麦赤霉病', 'FUNGUS', 15, 25, 80, 95, 3, '孕穗抽穗期',
 '选用抗病品种；扬花期遇连阴雨重点预防',
 '扬花初期喷洒戊唑醇或氰烯菌酯，见花就打',
 '戊唑醇、氰烯菌酯、咪鲜胺'),
('蚜虫', 'INSECT', 18, 28, 60, 85, 0, '苗期,拔节期,抽穗期',
 '保护瓢虫、草蛉等天敌；清除田间杂草',
 '吡虫啉或啶虫脒喷雾，重点喷施嫩叶和心叶',
 '吡虫啉、啶虫脒、高效氯氟氰菊酯'),
('白粉病', 'FUNGUS', 15, 28, 60, 85, 2, '拔节期,抽穗期',
 '合理密植，增加通风透光；避免过量氮肥',
 '发病初期喷施三唑酮或嘧菌酯',
 '三唑酮、嘧菌酯、苯醚甲环唑'),
('玉米螟', 'INSECT', 20, 30, 65, 85, 0, '拔节孕穗期,抽雄吐丝期',
 '处理越冬秸秆，减少虫源基数',
 '心叶末期撒施辛硫磷颗粒剂；抽雄期喷Bt制剂',
 '辛硫磷、Bt制剂、甲维盐'),
('霜霉病', 'FUNGUS', 15, 22, 80, 95, 2, '苗期,挂果期',
 '加强通风排湿；清除病残体',
 '发病前喷施代森锰锌预防；发病后用霜脲氰',
 '代森锰锌、霜脲氰、烯酰吗啉'),
('红蜘蛛', 'INSECT', 25, 35, 40, 70, 0, '苗期,挂果期',
 '保持田间湿度；保护捕食螨',
 '阿维菌素或哒螨灵喷雾，叶背重点喷施',
 '阿维菌素、哒螨灵、螺螨酯');

-- 节气农事指南
INSERT INTO solar_term_guide (term_name, term_date_range, crop_stages, farm_tasks, pest_risks, traditional_tips) VALUES
('立春', '2月3-5日', '冬小麦返青；早稻备耕',
 '检修农机具；准备种子肥料；大棚蔬菜定植',
 '小麦蚜虫始发',
 '立春一年端，种地早盘算'),
('雨水', '2月18-20日', '冬小麦返青拔节；油菜抽薹',
 '追施返青肥；果园修剪；麦田化学除草',
 '小麦纹枯病',
 '雨水有雨庄稼好，大春小春一片宝'),
('惊蛰', '3月5-7日', '早稻播种育秧；春玉米播种',
 '水稻浸种催芽；果树嫁接；茶园春剪',
 '地下害虫开始活动',
 '惊蛰春雷响，农夫闲转忙'),
('春分', '3月20-22日', '早稻育秧；棉花育苗',
 '抢晴播种；麦田春灌；果树花前追肥',
 '麦蜘蛛',
 '春分麦起身，一刻值千金'),
('清明', '4月4-6日', '早稻插秧；玉米苗期',
 '水稻抛秧移栽；瓜菜定植；茶园采春茶',
 '稻蓟马、螟虫',
 '清明前后，种瓜点豆'),
('谷雨', '4月19-21日', '早稻分蘖；棉花苗期',
 '查苗补苗；中耕除草；防治苗期病害',
 '棉蚜、立枯病',
 '谷雨前后一场雨，胜似秀才中了举'),
('立夏', '5月5-7日', '早稻分蘖盛期；小麦灌浆',
 '晒田控蘖；茶园夏剪；果园疏果',
 '一代螟虫',
 '立夏不下，犁耙高挂'),
('小满', '5月20-22日', '小麦乳熟；早稻拔节',
 '麦田去杂；稻田追穗肥；防治赤霉病',
 '小麦赤霉病、蚜虫',
 '小满不满，麦有一险'),
('芒种', '6月5-7日', '小麦收获；晚稻播种',
 '抢收小麦；抢种夏玉米夏大豆；秸秆还田',
 '玉米螟、粘虫',
 '芒种忙，麦上场'),
('夏至', '6月21-22日', '夏玉米苗期；早稻抽穗',
 '玉米间苗定苗；稻田水层管理；果园夏剪',
 '稻纵卷叶螟',
 '夏至不锄根边草，如同养下毒蛇咬'),
('小暑', '7月6-8日', '早稻灌浆；夏玉米拔节',
 '稻田干湿交替；玉米追攻穗肥；防治病虫害',
 '稻飞虱、玉米螟',
 '小暑天气热，棉花整枝不停歇'),
('大暑', '7月22-24日', '早稻成熟；晚稻育秧',
 '抢收早稻；晚稻播种育秧；防伏旱',
 '纹枯病、稻瘟病',
 '大暑不割禾，一天少一箩'),
('立秋', '8月7-9日', '晚稻分蘖；玉米灌浆',
 '晚稻追肥；棉花打顶；秋菜播种',
 '三代棉铃虫',
 '立秋十八日，寸草皆结籽'),
('处暑', '8月22-24日', '晚稻拔节；玉米成熟',
 '玉米收获晾晒；秋耕备播；茶园秋管',
 '稻纵卷叶螟',
 '处暑谷渐黄，大风要提防'),
('白露', '9月7-9日', '晚稻抽穗；冬小麦备播',
 '油菜育苗；蔬菜秋播；果园施基肥',
 '稻飞虱回迁',
 '白露秋分夜，一夜凉一夜'),
('秋分', '9月22-24日', '晚稻灌浆；冬小麦播种',
 '抢墒播种冬小麦；收获花生红薯；',
 '小麦地下害虫',
 '秋分种麦正当时'),
('寒露', '10月7-9日', '冬小麦出苗；晚稻成熟',
 '晚稻收割；小麦查苗补种；果园采后施肥',
 '麦田杂草',
 '寒露时节天渐寒，农夫不停收种忙'),
('霜降', '10月23-24日', '冬小麦苗期；秋收扫尾',
 '抢收红薯；大棚覆膜；果园清园冬灌',
 '小麦蚜虫越冬基数',
 '霜降见霜，米谷满仓'),
('立冬', '11月7-8日', '冬小麦分蘖；油菜苗期',
 '麦田冬灌；果园冬剪清园；检修大棚',
 '农田鼠害',
 '立冬之日起大雾，冬水田里点萝卜'),
('小雪', '11月22-23日', '冬小麦越冬前；大棚蔬菜',
 '麦田镇压保墒；加固大棚；畜牧防寒保暖',
 '越冬病虫基数调查',
 '小雪雪满天，来年必丰年'),
('大雪', '12月6-8日', '冬小麦越冬；果树休眠',
 '设施农业保温；积肥造肥；农机具保养',
 '',
 '大雪半溶加一冰，来年病虫发生轻'),
('冬至', '12月21-23日', '越冬作物管理',
 '清沟理墒；积造农家肥；果园冬季修剪',
 '',
 '冬至一阳生，来年好收成'),
('小寒', '1月5-7日', '越冬作物管理；大棚生产',
 '设施蔬菜管理；果树冬季修剪；检修水利设施',
 '',
 '小寒大寒，冷成冰团，防冻为先'),
('大寒', '1月20-21日', '冬小麦越冬末期',
 '备耕备种；检修农机；制定年度种植计划',
 '',
 '大寒不寒，人马不安');


-- =============================================
-- 农友社区（新增）
-- =============================================

CREATE TABLE IF NOT EXISTS community_post (
  id             BIGINT        NOT NULL AUTO_INCREMENT,
  user_id        BIGINT        NOT NULL COMMENT '作者',
  title          VARCHAR(100)  DEFAULT NULL,
  content        MEDIUMTEXT    NOT NULL COMMENT 'TEXT 为纯文本，HTML 为净化后的富文本',
  content_format VARCHAR(10)   NOT NULL DEFAULT 'TEXT' COMMENT 'TEXT/HTML',
  category       VARCHAR(20)   DEFAULT 'CHAT' COMMENT 'CHAT/TECH/ALERT',
  like_count    INT           DEFAULT 0,
  comment_count INT           DEFAULT 0,
  status        INT           DEFAULT 0 COMMENT '0 正常 1 已删除',
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_post_status_id (status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS community_comment (
  id         BIGINT        NOT NULL AUTO_INCREMENT,
  post_id    BIGINT        NOT NULL,
  user_id    BIGINT        NOT NULL,
  content    VARCHAR(1000) NOT NULL,
  created_at DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comment_post_id (post_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS community_like (
  id         BIGINT   NOT NULL AUTO_INCREMENT,
  post_id    BIGINT   NOT NULL,
  user_id    BIGINT   NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_like_post_user (post_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 社区图片：二进制存库，多实例共享，无需文件挂载
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
