package com.agriweather.repository;

import com.agriweather.entity.CropInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CropInfoRepository extends JpaRepository<CropInfo, Long> {
    List<CropInfo> findByCropNameContaining(String keyword);
}
