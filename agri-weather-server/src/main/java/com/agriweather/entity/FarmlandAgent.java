package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 地块专属助农手。一块地一个，人设和知识库互相独立。
 */
@Entity
@Table(name = "farmland_agent")
@Data
@NoArgsConstructor
public class FarmlandAgent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "farmland_id", nullable = false, unique = true)
    private Long farmlandId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 16)
    private String avatar;

    @Column(columnDefinition = "MEDIUMTEXT")
    private String persona;

    @Column(length = 500)
    private String welcome;

    /** 用户改过人设后，作物变更不再覆盖 */
    @Column(name = "persona_custom", nullable = false)
    private Boolean personaCustom = false;

    /** 逗号分隔的工具名；空表示全部启用 */
    @Column(name = "enabled_tools", length = 500)
    private String enabledTools;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}