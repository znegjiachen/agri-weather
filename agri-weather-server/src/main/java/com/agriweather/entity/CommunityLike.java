package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 点赞关系。联合唯一索引（post_id, user_id）是防重复点赞的最终防线，
 * 应用层的 exists 判断只是为了少打一次数据库。
 */
@Entity
@Table(name = "community_like", uniqueConstraints = {
        @UniqueConstraint(name = "uk_like_post_user", columnNames = {"post_id", "user_id"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
