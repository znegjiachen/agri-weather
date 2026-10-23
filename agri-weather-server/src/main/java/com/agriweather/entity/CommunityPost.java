package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 社区帖子。
 *
 * 刻意不建 userId → SysUser 的 @ManyToOne 关联：
 * 列表页需要批量取用户名，用 join 反而会触发懒加载与循环引用，
 * 这里只存 userId，由 Service 层批量查询补齐。
 */
@Entity
@Table(name = "community_post", indexes = {
        @Index(name = "idx_post_status_id", columnList = "status,id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(length = 100)
    private String title;

    /** 纯文本或净化后的 HTML，格式由 contentFormat 决定 */
    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    private String content;

    /** TEXT 纯文本（含历史数据）/ HTML 富文本 */
    @Column(name = "content_format", nullable = false, length = 10)
    @Builder.Default
    private String contentFormat = "TEXT";

    /** CHAT 闲聊 / TECH 技术 / ALERT 预警分享 */
    @Column(length = 20)
    @Builder.Default
    private String category = "CHAT";

    @Column(name = "like_count")
    @Builder.Default
    private Integer likeCount = 0;

    @Column(name = "comment_count")
    @Builder.Default
    private Integer commentCount = 0;

    /** 0 正常 / 1 已删除（软删除，避免删帖后评论变成孤儿） */
    @Column
    @Builder.Default
    private Integer status = 0;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
