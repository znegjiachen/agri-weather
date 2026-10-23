package com.agriweather.dto;

/** 上传成功后的图片信息，url 为同源相对路径，开发/生产都可直接用于 &lt;img src&gt; */
public record CommunityImageUploadResponse(
        String id,
        String url,
        int width,
        int height,
        int byteSize,
        String mimeType
) {
}