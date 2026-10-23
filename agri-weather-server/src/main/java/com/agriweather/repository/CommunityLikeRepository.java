package com.agriweather.repository;

import com.agriweather.entity.CommunityLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CommunityLikeRepository extends JpaRepository<CommunityLike, Long> {

    boolean existsByPostIdAndUserId(Long postId, Long userId);

    long deleteByPostIdAndUserId(Long postId, Long userId);

    /** 列表页一次性查出当前用户点过赞的帖子 */
    List<CommunityLike> findByUserIdAndPostIdIn(Long userId, Collection<Long> postIds);
}
