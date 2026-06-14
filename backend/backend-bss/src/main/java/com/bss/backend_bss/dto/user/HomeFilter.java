package com.bss.backend_bss.dto.user;

import lombok.Data;

/**
 * Query params for GET /api/user/home/filter — the home page filter bar.
 *
 * All fields are optional; an absent field means "don't filter on this". Bound
 * from query params via @ModelAttribute.
 *
 *   date       yyyy-MM-dd (defaults to today on the server)
 *   q          free-text matched against program name OR content
 *   category   one of the 7 Program.Category names
 *   channelId  exact channel id
 *   bookmarked true = only bookmarked, false = only not-bookmarked, null = any
 *   reminded   true = only with a reminder, false = only without, null = any
 *   timeStart  "HH:mm" lower bound on the program's start time
 *   timeEnd    "HH:mm" upper bound on the program's start time
 */
@Data
public class HomeFilter {
    private String date;
    private String q;
    private String category;
    private String channelId;
    private Boolean bookmarked;
    private Boolean reminded;
    private String timeStart;
    private String timeEnd;
}
