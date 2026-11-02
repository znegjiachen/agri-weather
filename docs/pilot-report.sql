-- 试点数据导出脚本（MySQL 8）
-- 用途：把真实使用情况汇总成答辩/复盘可引用的数字，不代替用户访谈。

-- 1. 总体规模
SELECT
  (SELECT COUNT(*) FROM sys_user) AS users,
  (SELECT COUNT(*) FROM farmland) AS farmlands,
  (SELECT COUNT(*) FROM farmland_agent) AS agents;

-- 2. 每日对话量（最近 30 天）
SELECT DATE(created_at) AS day,
       COUNT(*) AS messages,
       COUNT(DISTINCT user_id) AS active_users
FROM agent_chat_message
WHERE role = 'user'
  AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(created_at)
ORDER BY day;

-- 3. 人均提问次数（最近 7 天）
SELECT COUNT(*) / NULLIF(COUNT(DISTINCT user_id), 0) AS q_per_active_user
FROM agent_chat_message
WHERE role = 'user'
  AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);

-- 4. 回答满意度
SELECT rating, COUNT(*) AS total
FROM agent_feedback
GROUP BY rating;

SELECT ROUND(
  SUM(rating = 'UP') / NULLIF(SUM(rating IN ('UP', 'DOWN')), 0) * 100, 1
) AS satisfaction_pct
FROM agent_feedback;

-- 5. 文档问答使用量（最近 30 天）
SELECT COUNT(*) AS turns_with_document
FROM agent_chat_message
WHERE role = 'user'
  AND document_ids IS NOT NULL
  AND document_ids <> ''
  AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);

-- 6. 预警触达与处理
SELECT COUNT(*) AS alerts,
       SUM(is_read = TRUE) AS read_alerts,
       SUM(is_handled = TRUE) AS handled_alerts
FROM weather_alert
WHERE alert_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);

-- 7. Web Push 订阅数
SELECT COUNT(*) AS push_subscriptions,
       COUNT(DISTINCT user_id) AS subscribed_users
FROM push_subscription;

-- 8. 地块季节与农事记录（证明农事闭环真的被使用）
SELECT COUNT(*) AS seasons FROM farmland_season;
SELECT operation_type, COUNT(*) AS total
FROM farm_operation
GROUP BY operation_type
ORDER BY total DESC;

-- 9. 方案任务执行情况（证明“方案→任务→执行→偏差”闭环被使用）
SELECT status, COUNT(*) AS total
FROM farm_plan_task
GROUP BY status;

SELECT
  COUNT(*) AS total_tasks,
  SUM(status = 'DONE') AS done_tasks,
  SUM(status = 'SKIPPED') AS skipped_tasks,
  SUM(status = 'PENDING' AND planned_date < CURDATE()) AS overdue_tasks,
  ROUND(SUM(status = 'DONE' AND actual_date <= planned_date)
        / NULLIF(SUM(status = 'DONE' AND planned_date IS NOT NULL AND actual_date IS NOT NULL), 0) * 100, 1)
    AS on_time_pct
FROM farm_plan_task;
