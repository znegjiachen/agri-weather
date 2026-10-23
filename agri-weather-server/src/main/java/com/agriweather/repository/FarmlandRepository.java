package com.agriweather.repository;

import com.agriweather.entity.Farmland;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface FarmlandRepository extends JpaRepository<Farmland, Long> {
    List<Farmland> findByUserId(Long userId);

    /** 去重后的地块坐标，供天气预取使用（返回 [lat, lng]） */
    @Query("select distinct f.lat, f.lng from Farmland f where f.lat is not null and f.lng is not null")
    List<Object[]> findDistinctCoordinates();
}
