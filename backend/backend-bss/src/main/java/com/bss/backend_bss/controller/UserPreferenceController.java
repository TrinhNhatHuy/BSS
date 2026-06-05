package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.PreferenceResponse;
import com.bss.backend_bss.dto.user.SetPreferencesRequest;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.UserPreferenceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * The caller's favourite categories.
 *
 *   GET /api/user/preferences  → current favourites (empty = new user → onboarding)
 *   PUT /api/user/preferences  → set 1–2 favourites (replace semantics)
 */
@RestController
@RequestMapping("/api/user/preferences")
@RequiredArgsConstructor
public class UserPreferenceController {

    private final UserPreferenceService userPreferenceService;

    @GetMapping
    public ResponseEntity<PreferenceResponse> get(@AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(userPreferenceService.get(me.getUser().getId()));
    }

    @PutMapping
    public ResponseEntity<PreferenceResponse> set(
            @AuthenticationPrincipal CustomUserDetails me,
            @Valid @RequestBody SetPreferencesRequest request
    ) {
        return ResponseEntity.ok(userPreferenceService.set(me.getUser().getId(), request.getCategories()));
    }
}