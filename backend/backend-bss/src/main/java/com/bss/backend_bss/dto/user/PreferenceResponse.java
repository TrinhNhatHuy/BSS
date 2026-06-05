package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * GET/PUT /api/user/preferences response.
 *
 * {@code categories} is empty for a brand-new user — the frontend uses that to
 * redirect to the onboarding page.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreferenceResponse {
    private List<String> categories;
}