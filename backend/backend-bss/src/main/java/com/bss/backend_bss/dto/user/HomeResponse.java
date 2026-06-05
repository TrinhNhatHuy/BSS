package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * GET /api/user/home payload.
 *
 * Returns the whole day's labeled schedule plus the caller's preferences; the
 * frontend filters by category chip client-side (so switching chips is instant)
 * and defaults the selection to {@code preferences}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HomeResponse {
    private String date;                    // yyyy-MM-dd
    private List<String> preferences;       // user's favourite categories
    private Map<String, Long> categoryCounts; // category -> #programs today
    private List<HomeProgramResponse> programs;
}