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

    /**
     * 列表 / 搜索：分类和关键词都是可选的。
     * 关键词匹配标题与正文；富文本正文里可能命中标签，属于可接受的边角情况。
     */
    @Query("""
            select p from CommunityPost p
            where p.status = :status
              and (:cursor is null or p.id < :cursor)
              and (:category is null or p.category = :category)
              and (:q is null
                   or lower(p.title) like lower(concat('%', :q, '%'))
                   or lower(p.content) like lower(concat('%', :q, '%')))
            order by p.id desc
            """)
    List<CommunityPost> search(@Param("status") Integer status,
                               @Param("cursor") Long cursor,
                               @Param("category") String category,
                               @Param("q") String q,
                               Pageable pageable);

    /** 原子增减，避免 select→set→save 在并发下丢更新 */
    @Modifying(clearAutomatically = true)
    @Query("update CommunityPost p set p.likeCount = p.likeCount + :delta where p.id = :id")
    int addLikeCount(@Param("id") Long id, @Param("delta") int delta);

    @Modifying(clearAutomatically = true)
    @Query("update CommunityPost p set p.commentCount = p.commentCount + 1 where p.id = :id")
    int incCommentCount(@Param("id") Long id);
}
