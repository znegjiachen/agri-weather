package com.agriweather.repository;

import com.agriweather.entity.WeatherAlert;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface WeatherAlertRepository extends JpaRepository<WeatherAlert, Long> {
    List<WeatherAlert> findByUserIdOrderByAlertTimeDesc(Long userId);

    List<WeatherAlert> findByUserIdOrderByAlertTimeDesc(Long userId, Pageable pageable);

    /** 未处理（含旧的 null 状态）预警，供首页/重点视图使用 */
    @Query("""
            select a from WeatherAlert a
            where a.userId = :userId
              and (a.isHandled is null or a.isHandled = false)
            order by a.alertTime desc
            """)
    List<WeatherAlert> findActiveForUser(@Param("userId") Long userId, Pageable pageable);
    List<WeatherAlert> findByFarmlandIdOrderByAlertTimeDesc(Long farmlandId);
    List<WeatherAlert> findByUserIdAndIsReadFalse(Long userId);
    long countByUserIdAndIsReadFalse(Long userId);
}
