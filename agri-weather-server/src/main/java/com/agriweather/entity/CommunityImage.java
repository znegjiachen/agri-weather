package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 社区图片。
 *
 * 二进制直接存库：部署是双实例 + Nginx，本地文件需要额外共享卷，
 * 图片量级小（单张 ≤5MB、每帖 ≤9 张），BLOB 换取部署一致性更划算。
 * 对外 URL 用随机 publicId，不暴露自增 id，也能避免被顺序枚举。
 */
@Entity
@Table(name = "community_image", indexes = {
        @Index(name = "idx_image_user", columnList = "user_id"),
        @Index(name = "idx_image_post", columnList = "post_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 32)
    private String publicId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 挂接的帖子；null 表示已上传但尚未发布，超过 24h 由定时任务清理 */
    @Column(name = "post_id")
    private Long postId;

    @Column(name = "mime_type", nullable = false, length = 40)
    private String mimeType;

    @Column(name = "byte_size", nullable = false)
    private Integer byteSize;

    @Column(nullable = false)
    private Integer width;

    @Column(nullable = false)
    private Integer height;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGBLOB")
    private byte[] data;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}