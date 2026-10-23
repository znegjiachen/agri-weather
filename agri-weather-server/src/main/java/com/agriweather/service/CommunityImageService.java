package com.agriweather.service;

import com.agriweather.controller.ResourceNotFoundException;
import com.agriweather.dto.CommunityImageUploadResponse;
import com.agriweather.entity.CommunityImage;
import com.agriweather.repository.CommunityImageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommunityImageService {

    public static final String URL_PREFIX = "/api/community/images/";

    private final CommunityImageRepository imageRepo;
    private final CommunityImageProcessor processor;

    @Transactional
    public CommunityImageUploadResponse upload(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请选择图片");
        }
        if (file.getSize() > CommunityImageProcessor.MAX_BYTES) {
            throw new IllegalArgumentException("图片不能超过 5MB");
        }

        byte[] raw;
        try {
            raw = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("图片读取失败，请重试");
        }

        CommunityImageProcessor.ProcessedImage processed = processor.process(raw);
        String publicId = UUID.randomUUID().toString().replace("-", "");

        imageRepo.save(CommunityImage.builder()
                .publicId(publicId)
                .userId(userId)
                .mimeType(processed.mimeType())
                .byteSize(processed.data().length)
                .width(processed.width())
                .height(processed.height())
                .data(processed.data())
                .build());

        log.info("社区图片已上传 user={} id={} {}x{} {}KB", userId, publicId,
                processed.width(), processed.height(), processed.data().length / 1024);
        return new CommunityImageUploadResponse(
                publicId,
                URL_PREFIX + publicId,
                processed.width(),
                processed.height(),
                processed.data().length,
                processed.mimeType());
    }

    @Transactional(readOnly = true)
    public CommunityImage load(String publicId) {
        return imageRepo.findByPublicId(publicId)
                .orElseThrow(() -> new ResourceNotFoundException("图片不存在"));
    }

    /**
     * 发帖时校验图片归属，并把图片挂到帖子上。
     * 校验放在帖子事务里：任何一张不合法都会让整帖回滚，不会留下半成品。
     */
    @Transactional
    public void attachToPost(Long postId, Long userId, List<String> publicIds) {
        List<String> ids = publicIds.stream().distinct().toList();
        if (ids.isEmpty()) {
            return;
        }

        Map<String, CommunityImageRepository.ImageMeta> metas = imageRepo.findMetaByPublicIdIn(ids)
                .stream()
                .collect(Collectors.toMap(CommunityImageRepository.ImageMeta::getPublicId,
                        Function.identity(), (a, b) -> a));

        if (metas.size() != ids.size()) {
            throw new IllegalArgumentException("图片不存在或无权使用");
        }
        for (String id : ids) {
            if (!userId.equals(metas.get(id).getUserId())) {
                // 统一话术，避免通过错误信息枚举别人的图片是否存在
                throw new IllegalArgumentException("图片不存在或无权使用");
            }
        }
        for (String id : ids) {
            imageRepo.attachToPost(id, userId, postId);
        }
    }

    /** 删除超时未发布的图片（上传了但没发帖），多实例同时跑也幂等 */
    @Transactional
    public int cleanupOrphans(LocalDateTime cutoff) {
        return imageRepo.deleteOrphansBefore(cutoff);
    }
}