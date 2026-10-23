package com.agriweather.repository;

import com.agriweather.entity.CommunityImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CommunityImageRepository extends JpaRepository<CommunityImage, Long> {

    Optional<CommunityImage> findByPublicId(String publicId);

    /**
     * 只取元数据，不加载 LONGBLOB。
     * 发帖校验一次最多 9 张，若用实体查询会顺带把几十 MB 图片读进堆。
     */
    @Query("""
            select i.publicId as publicId, i.userId as userId, i.postId as postId,
                   i.width as width, i.height as height
            from CommunityImage i
            where i.publicId in :publicIds
            """)
    List<ImageMeta> findMetaByPublicIdIn(@Param("publicIds") Collection<String> publicIds);

    /** 只在未挂接时挂接，避免覆盖已发布帖子的归属 */
    @Modifying
    @Query("""
            update CommunityImage i
            set i.postId = :postId
            where i.publicId = :publicId and i.userId = :userId and i.postId is null
            """)
    int attachToPost(@Param("publicId") String publicId,
                     @Param("userId") Long userId,
                     @Param("postId") Long postId);

    /** 批量删除超时未发布的图片，不把 blob 读进内存 */
    @Modifying
    @Query("delete from CommunityImage i where i.postId is null and i.createdAt < :cutoff")
    int deleteOrphansBefore(@Param("cutoff") LocalDateTime cutoff);

    interface ImageMeta {
        String getPublicId();

        Long getUserId();

        Long getPostId();

        Integer getWidth();

        Integer getHeight();
    }
}