package com.bss.backend_bss.dto.user;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Body for PUT /api/user/preferences — the 1–2 favourite categories chosen at
 * onboarding (or changed later). Values are validated against the Category enum
 * in the service.
 */
@Data
public class SetPreferencesRequest {

    @NotEmpty(message = "Pick at least one category.")
    @Size(min = 1, max = 2, message = "Pick 1 or 2 categories.")
    private List<String> categories;
}