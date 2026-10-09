package com.agriweather.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sys_user")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SysUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(length = 20)
    @Builder.Default
    private String role = "FARMER";

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String region;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
