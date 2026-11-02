-- 地块季节历史：换茬新增记录，不覆盖历史
CREATE TABLE IF NOT EXISTS farmland_season (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    farmland_id BIGINT NOT NULL,
    crop_id BIGINT,
    season_name VARCHAR(50),
    plant_date DATE,
    expected_harvest_date DATE,
    harvest_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANTED' COMMENT 'PLANTED/HARVESTED/FALLOW',
    notes VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_season_farmland (farmland_id, plant_date),
    CONSTRAINT fk_season_farmland FOREIGN KEY (farmland_id) REFERENCES farmland(id) ON DELETE CASCADE,
    CONSTRAINT fk_season_crop FOREIGN KEY (crop_id) REFERENCES crop_info(id)
) ENGINE=InnoDB COMMENT='地块季节历史';
