package com.agriweather.repository;

import com.agriweather.entity.Farmland;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FarmlandRepository extends JpaRepository<Farmland, Long> {
    List<Farmland> findByUserId(Long userId);
}
