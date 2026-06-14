package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET /api/user/home payload — a small, curated, multi-rail set (not the whole day).
 *
 * {@code rails} is an ordered list of shelves: "Top picks for you", themed rails
 * derived from the caller's behavior ("Because you watch …", "More … for you",
 * "Your shows today"), and "Popular with viewers". {@code personalized} is the
 * overall flag — false when the caller is cold-start and the picks came from global
 * popularity instead. {@code upNext} is the soonest upcoming programs on any channel
 * (the right-rail list).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HomeResponse {
    private String date;                    // yyyy-MM-dd
    private List<String> preferences;       // user's favourite categories
    private boolean personalized;           // true = picks came from the caller's behavior
    private List<HomeRailResponse> rails;
    private List<HomeProgramResponse> upNext;
}
