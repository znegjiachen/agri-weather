package com.agriweather.repository;

import com.agriweather.entity.CommunityPost;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    /** 游标分页首页 */
    List<CommunityPost> findByStatusOrderByIdDesc(Integer status, Pageable pageable);

    /** 游标分页翻页：id 小于游标，避免 offset 在新帖插入时重复/漏数据 */
    List<CommunityPost> findByStatusAndIdLessThanOrderByIdDesc(Integer status, Long cursor, Pageable pageable);

    /** 原子增减，避免 select→set→save 在并发下丢更新 */
    @Modifying(clearAutomatically = true)
    @Query("update CommunityPost p set p.likeCount = p.likeCount + :delta where p.id = :id")
    int addLikeCount(@Param("id") Long id, @Param("delta") int delta);

    @Modifying(clearAutomatically = true)
    @Query("update CommunityPost p set p.commentCount = p.commentCount + 1 where p.id = :id")
    int incCommentCount(@Param("id") Long id);
}
