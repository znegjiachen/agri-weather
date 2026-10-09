package com.agriweather.repository;

import com.agriweather.entity.SysUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<SysUser, Long> {
    Optional<SysUser> findByUsername(String username);
    boolean existsByUsername(String username);
}
