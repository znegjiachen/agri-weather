package com.agriweather.controller;

import com.agriweather.dto.CommunityImageUploadResponse;
import com.agriweather.entity.CommunityImage;
import com.agriweather.service.CommunityImageService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;

/**
 * 社区图片。
 *
 * 上传需要登录；读取是公开的 —— 帖子本身允许匿名浏览，
 * 图片若要求鉴权，未登录访客看到的就全是裂图。
 */
@RestController
@RequestMapping("/api/community/images")
@RequiredArgsConstructor
public class CommunityImageController {

    private final CommunityImageService imageService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityImageUploadResponse upload(@RequestParam("file") MultipartFile file,
                                               HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录");
        }
        return imageService.upload(userId, file);
    }

    @GetMapping("/{publicId}")
    public ResponseEntity<byte[]> image(@PathVariable String publicId) {
        CommunityImage image = imageService.load(publicId);
        byte[] data = image.getData();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getMimeType()))
                .contentLength(data.length)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline")
                .body(data);
    }
}