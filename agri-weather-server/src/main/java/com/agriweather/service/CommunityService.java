package com.agriweather.service;

import com.agriweather.dto.CommentView;
import com.agriweather.dto.CreatePostRequest;
import com.agriweather.dto.PostDetail;
import com.agriweather.dto.PostSummary;
import com.agriweather.dto.PostView;
import com.agriweather.entity.CommunityComment;
import com.agriweather.entity.CommunityLike;
import com.agriweather.entity.CommunityPost;
import com.agriweather.entity.SysUser;
import com.agriweather.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityService {

    private static final int NORMAL = 0;
    private static final int DELETED = 1;
    private static final int MAX_PAGE = 20;
    private static final Set<String> CATEGORIES = Set.of("CHAT", "TECH", "ALERT");
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    static final String FORMAT_TEXT = "TEXT";
    static final String FORMAT_HTML = "HTML";

    private final CommunityPostRepository postRepo;
    private final CommunityCommentRepository commentRepo;
    private final CommunityLikeRepository likeRepo;
    private final CommunityImageRepository imageRepo;
    private final UserRepository userRepo;
    private final CommunityHtmlSanitizer sanitizer;
    private final CommunityImageService imageService;

    /**
     * 游标分页 + 可选关键词/分类过滤。
     * 没有 q/category 时行为与旧的纯列表一致。
     */
    public List<PostSummary> list(Long cursor, int size, Long userId, String q, String category) {
        int limit = Math.max(1, Math.min(size, MAX_PAGE));
        Pageable page = PageRequest.of(0, limit);

        List<CommunityPost> posts = postRepo.search(
                NORMAL, cursor, normalizeFilterCategory(category), normalizeQuery(q), page);

        return toSummaries(posts, userId);
    }

    public PostDetail detail(Long id, Long userId) {
        CommunityPost post = requirePost(id);
        List<CommunityComment> comments = commentRepo.findByPostIdOrderByIdAsc(id);

        Set<Long> authorIds = new HashSet<>();
        authorIds.add(post.getUserId());
        comments.forEach(c -> authorIds.add(c.getUserId()));
        Map<Long, String> names = loadNames(authorIds);

        PostView pv = toView(post, userId, names);
        List<CommentView> cvs = comments.stream()
                .map(c -> new CommentView(
                        c.getId(),
                        c.getContent(),
                        names.getOrDefault(c.getUserId(), "农友"),
                        c.getUserId(),
                        c.getCreatedAt() == null ? "" : c.getCreatedAt().format(FMT)))
                .toList();

        return new PostDetail(pv, cvs);
    }

    @Transactional
    public PostView create(Long userId, CreatePostRequest req) {
        String format = normalizeFormat(req.contentFormat());
        String raw = req.content() == null ? "" : req.content().trim();

        String content;
        List<String> imageIds = List.of();

        if (FORMAT_HTML.equals(format)) {
            CommunityHtmlSanitizer.SanitizedContent sanitized = sanitizer.sanitize(raw);
            imageIds = sanitized.imageIds();
            if (sanitized.text().isBlank() && imageIds.isEmpty()) {
                throw new IllegalArgumentException("内容不能为空");
            }
            if (sanitized.text().length() > CommunityHtmlSanitizer.MAX_TEXT_LENGTH) {
                throw new IllegalArgumentException("内容不超过 2000 字");
            }
            if (imageIds.size() > CommunityHtmlSanitizer.MAX_IMAGES) {
                throw new IllegalArgumentException("每帖最多 9 张图片");
            }
            content = sanitized.html();
        } else {
            if (raw.isEmpty()) {
                throw new IllegalArgumentException("内容不能为空");
            }
            if (raw.length() > CommunityHtmlSanitizer.MAX_TEXT_LENGTH) {
                throw new IllegalArgumentException("内容不超过 2000 字");
            }
            content = raw;
        }

        CommunityPost post = CommunityPost.builder()
                .userId(userId)
                .title(req.title() == null ? "" : req.title().trim())
                .content(content)
                .contentFormat(format)
                .category(normalizeCategory(req.category()))
                .build();
        CommunityPost saved = postRepo.saveAndFlush(post);

        // 同一事务：图片不存在/不属于本人时整帖回滚，不留半成品
        if (FORMAT_HTML.equals(format) && !imageIds.isEmpty()) {
            imageService.attachToPost(saved.getId(), userId, imageIds);
        }

        return toView(saved, Set.of(), loadNames(Set.of(userId)));
    }

    @Transactional
    public void delete(Long id, Long userId) {
        CommunityPost post = requirePost(id);
        if (!Objects.equals(post.getUserId(), userId)) {
            throw new SecurityException("只能删除自己发布的帖子");
        }
        post.setStatus(DELETED);
        postRepo.save(post);
    }

    @Transactional
    public CommentView addComment(Long postId, Long userId, String content) {
        requirePost(postId);

        CommunityComment saved = commentRepo.save(CommunityComment.builder()
                .postId(postId)
                .userId(userId)
                .content(content.trim())
                .build());

        postRepo.incCommentCount(postId);

        String author = userRepo.findById(userId).map(SysUser::getUsername).orElse("农友");
        return new CommentView(saved.getId(), saved.getContent(), author, userId,
                saved.getCreatedAt() == null ? "" : saved.getCreatedAt().format(FMT));
    }

    @Transactional
    public PostView like(Long postId, Long userId, boolean like) {
        requirePost(postId);

        if (like) {
            if (!likeRepo.existsByPostIdAndUserId(postId, userId)) {
                try {
                    likeRepo.save(CommunityLike.builder().postId(postId).userId(userId).build());
                    postRepo.addLikeCount(postId, 1);
                } catch (DataIntegrityViolationException e) {
                    // 并发下另一请求已插入：视为已点赞，不报错
                    log.debug("重复点赞已忽略 post={} user={}", postId, userId);
                }
            }
        } else {
            if (likeRepo.deleteByPostIdAndUserId(postId, userId) > 0) {
                postRepo.addLikeCount(postId, -1);
            }
        }

        // addLikeCount 会清空持久化上下文，这里重新读一次拿最新计数。
        // 点赞态直接取本次操作的期望值 —— 在同一事务里再查一次可能读到未刷新的旧状态。
        CommunityPost fresh = requirePost(postId);
        Map<Long, String> names = loadNames(Set.of(fresh.getUserId()));
        return toView(fresh, like ? Set.of(postId) : Set.of(), names);
    }

    // ---------------- 内部 ----------------

    private List<PostSummary> toSummaries(List<CommunityPost> posts, Long userId) {
        if (posts.isEmpty()) return List.of();

        Map<Long, String> names = loadNames(
                posts.stream().map(CommunityPost::getUserId).collect(Collectors.toSet()));

        Set<Long> likedIds = Set.of();
        if (userId != null) {
            likedIds = likeRepo
                    .findByUserIdAndPostIdIn(userId, posts.stream().map(CommunityPost::getId).toList())
                    .stream().map(CommunityLike::getPostId).collect(Collectors.toSet());
        }

        Map<String, CommunityImageRepository.ImageMeta> covers = loadCovers(posts);

        final Set<Long> liked = likedIds;
        return posts.stream()
                .map(p -> toSummary(p, liked, names, covers))
                .toList();
    }

    /** 一次性批量取所有封面图的宽高，避免每张卡片查一次库 */
    private Map<String, CommunityImageRepository.ImageMeta> loadCovers(List<CommunityPost> posts) {
        Set<String> ids = posts.stream()
                .filter(p -> FORMAT_HTML.equals(storedFormat(p.getContentFormat())))
                .map(p -> sanitizer.firstImageId(p.getContent()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return imageRepo.findMetaByPublicIdIn(ids).stream()
                .collect(Collectors.toMap(CommunityImageRepository.ImageMeta::getPublicId,
                        java.util.function.Function.identity(), (a, b) -> a));
    }

    private PostSummary toSummary(CommunityPost p, Set<Long> likedIds, Map<Long, String> names,
                                  Map<String, CommunityImageRepository.ImageMeta> covers) {
        String format = storedFormat(p.getContentFormat());
        String coverImage = null;
        Integer coverWidth = null;
        Integer coverHeight = null;
        if (FORMAT_HTML.equals(format)) {
            String coverId = sanitizer.firstImageId(p.getContent());
            if (coverId != null) {
                coverImage = "/api/community/images/" + coverId;
                CommunityImageRepository.ImageMeta meta = covers.get(coverId);
                if (meta != null) {
                    coverWidth = meta.getWidth();
                    coverHeight = meta.getHeight();
                }
            }
        }
        return new PostSummary(
                p.getId(),
                p.getTitle(),
                sanitizer.excerpt(p.getContent(), format),
                coverImage,
                coverWidth,
                coverHeight,
                format,
                p.getCategory(),
                nz(p.getLikeCount()),
                nz(p.getCommentCount()),
                likedIds.contains(p.getId()),
                names.getOrDefault(p.getUserId(), "农友"),
                p.getUserId(),
                p.getCreatedAt() == null ? "" : p.getCreatedAt().format(FMT));
    }

    private PostView toView(CommunityPost p, Long userId, Map<Long, String> names) {
        boolean liked = userId != null && likeRepo.existsByPostIdAndUserId(p.getId(), userId);
        return toView(p, liked ? Set.of(p.getId()) : Set.of(), names);
    }

    private PostView toView(CommunityPost p, Set<Long> likedIds, Map<Long, String> names) {
        return new PostView(
                p.getId(),
                p.getTitle(),
                p.getContent(),
                storedFormat(p.getContentFormat()),
                p.getCategory(),
                nz(p.getLikeCount()),
                nz(p.getCommentCount()),
                likedIds.contains(p.getId()),
                names.getOrDefault(p.getUserId(), "农友"),
                p.getUserId(),
                p.getCreatedAt() == null ? "" : p.getCreatedAt().format(FMT));
    }

    private Map<Long, String> loadNames(Set<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return userRepo.findAllById(userIds).stream()
                .collect(Collectors.toMap(SysUser::getId, SysUser::getUsername));
    }

    private CommunityPost requirePost(Long id) {
        CommunityPost p = postRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("帖子不存在"));
        if (!Objects.equals(p.getStatus(), NORMAL)) {
            throw new IllegalArgumentException("帖子已删除");
        }
        return p;
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    /** 客户端只允许显式声明 TEXT/HTML；缺省按 TEXT，兼容尚未升级的旧前端 */
    private static String normalizeFormat(String raw) {
        if (raw == null || raw.isBlank()) return FORMAT_TEXT;
        String up = raw.trim().toUpperCase(Locale.ROOT);
        if (!FORMAT_TEXT.equals(up) && !FORMAT_HTML.equals(up)) {
            throw new IllegalArgumentException("不支持的内容格式");
        }
        return up;
    }

    /** 历史数据/异常值一律当纯文本，避免被当成 HTML 渲染 */
    private static String storedFormat(String raw) {
        return FORMAT_HTML.equalsIgnoreCase(raw) ? FORMAT_HTML : FORMAT_TEXT;
    }

    private static String normalizeCategory(String raw) {
        if (raw == null) return "CHAT";
        String up = raw.trim().toUpperCase(Locale.ROOT);
        return CATEGORIES.contains(up) ? up : "CHAT";
    }

    /** 列表筛选：ALL/空 表示不过滤；未知分类忽略，避免被随意参数拖慢查询 */
    private static String normalizeFilterCategory(String raw) {
        if (raw == null || raw.isBlank() || "ALL".equalsIgnoreCase(raw.trim())) {
            return null;
        }
        String up = raw.trim().toUpperCase(Locale.ROOT);
        return CATEGORIES.contains(up) ? up : null;
    }

    private static String normalizeQuery(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String q = raw.trim();
        return q.length() > 50 ? q.substring(0, 50) : q;
    }
}