package com.agriweather.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 注销账号：按外键顺序清理用户数据。
 * 社区帖子/评论/点赞/图片一并删除，不保留匿名痕迹。
 */
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final JdbcTemplate jdbc;

    @Transactional
    public void deleteAccount(Long userId) {
        jdbc.update("DELETE FROM agent_feedback WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM push_subscription WHERE user_id = ?", userId);
        jdbc.update("""
                DELETE FROM agent_document_chunk
                WHERE document_id IN (SELECT id FROM agent_document WHERE user_id = ?)
                """, userId);
        jdbc.update("DELETE FROM agent_document WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM agent_chat_message WHERE user_id = ?", userId);
        jdbc.update("""
                DELETE FROM agent_knowledge_chunk
                WHERE agent_id IN (SELECT id FROM farmland_agent WHERE user_id = ?)
                """, userId);
        jdbc.update("DELETE FROM agent_knowledge_doc WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM farmland_agent WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM weather_alert WHERE user_id = ?", userId);
        jdbc.update("""
                DELETE FROM farm_operation
                WHERE farmland_id IN (SELECT id FROM farmland WHERE user_id = ?)
                """, userId);
        jdbc.update("""
                DELETE FROM farmland_season
                WHERE farmland_id IN (SELECT id FROM farmland WHERE user_id = ?)
                """, userId);
        jdbc.update("DELETE FROM farmland WHERE user_id = ?", userId);

        jdbc.update("""
                DELETE FROM community_comment
                WHERE user_id = ? OR post_id IN (SELECT id FROM community_post WHERE user_id = ?)
                """, userId, userId);
        jdbc.update("""
                DELETE FROM community_like
                WHERE user_id = ? OR post_id IN (SELECT id FROM community_post WHERE user_id = ?)
                """, userId, userId);
        jdbc.update("DELETE FROM community_image WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM community_post WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM refresh_token WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM sys_user WHERE id = ?", userId);
    }
}