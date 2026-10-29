package com.agriweather.repository;

import com.agriweather.entity.FarmlandAgent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FarmlandAgentRepository extends JpaRepository<FarmlandAgent, Long> {

    Optional<FarmlandAgent> findByFarmlandId(Long farmlandId);

    Optional<FarmlandAgent> findByIdAndUserId(Long id, Long userId);

    List<FarmlandAgent> findByUserId(Long userId);

    List<FarmlandAgent> findByFarmlandIdIn(Collection<Long> farmlandIds);

    /**
     * 并发安全的「不存在才创建」：唯一键冲突时什么都不做，避免事务被标记 rollback-only。
     */
    @Modifying
    @Query(value = """
            INSERT INTO farmland_agent
                (user_id, farmland_id, name, avatar, persona, welcome, persona_custom, created_at, updated_at)
            VALUES
                (:userId, :farmlandId, :name, :avatar, :persona, :welcome, :personaCustom, NOW(), NOW())
            ON DUPLICATE KEY UPDATE id = id
            """, nativeQuery = true)
    int insertIfAbsent(@Param("userId") Long userId,
                       @Param("farmlandId") Long farmlandId,
                       @Param("name") String name,
                       @Param("avatar") String avatar,
                       @Param("persona") String persona,
                       @Param("welcome") String welcome,
                       @Param("personaCustom") boolean personaCustom);
}