package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A saved program in the right-rail "Bookmarked Programs" list
 * (GET /api/user/bookmarks).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookmarkResponse {
    private Long programId;
    private String channelId;
    private String channelName;
    private String beginTime;
    private String endTime;
    private String name;
    private String content;
    private String category;
}