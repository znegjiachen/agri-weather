package com.agriweather.dto;

import java.util.List;

public record PostDetail(PostView post, List<CommentView> comments) {
}
