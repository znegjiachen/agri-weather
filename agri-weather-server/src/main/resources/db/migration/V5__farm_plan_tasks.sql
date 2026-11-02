-- 方案任务：从种植方案抽取、确认后执行并统计偏差
CREATE TABLE IF NOT EXISTS farm_plan_task (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    farmland_id BIGINT NOT NULL,
    season_id BIGINT,
    title VARCHAR(200) NOT NULL,
    task_type VARCHAR(20),
    planned_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/DONE/SKIPPED',
    actual_date DATE,
    operation_id BIGINT,
    source_name VARCHAR(255),
    source_quote VARCHAR(500),
    notes VARCHAR(500),
    last_reminded_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY idx_task_farmland_date (farmland_id, planned_date),
    KEY idx_task_status_date (status, planned_date),
    CONSTRAINT fk_task_farmland FOREIGN KEY (farmland_id) REFERENCES farmland(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_season FOREIGN KEY (season_id) REFERENCES farmland_season(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='方案农事任务';
