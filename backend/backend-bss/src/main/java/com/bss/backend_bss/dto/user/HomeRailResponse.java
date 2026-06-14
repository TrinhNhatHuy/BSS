package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One horizontal shelf on the USER home page (Netflix-style).
 *
 * {@code key} is a stable id ("top_picks", "channel_VTV3", "category_News",
 * "your_shows", "popular", …); {@code title} is the display heading; {@code reason}
 * is an optional one-line "why you're seeing this". {@code personalized} is true
 * when the rail came from the caller's own behavior (vs. global popularity).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HomeRailResponse {
    private String key;
    private String title;
    private String reason;
    private boolean personalized;
    private List<HomeProgramResponse> programs;
}
