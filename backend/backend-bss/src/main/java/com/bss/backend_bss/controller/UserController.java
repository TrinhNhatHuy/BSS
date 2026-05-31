package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.ChangePasswordRequest;
import com.bss.backend_bss.dto.user.ProfileResponse;
import com.bss.backend_bss.dto.user.UpdateProfileRequest;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Self-service account endpoints. Under /api/user/** so any authenticated user
 * (USER / EDITOR / ADMIN) can manage their own account. The user id is taken
 * from the JWT principal, so these only ever act on the caller's own row.
 *
 *   GET  /api/user/profile           → current account details
 *   PUT  /api/user/profile           → update display name + email
 *   PUT  /api/user/profile/password  → change password (verifies current one)
 */
@RestController
@RequestMapping("/api/user/profile")
@RequiredArgsConstructor
public class UserController {

    private final UserProfileService userProfileService;

    @GetMapping
    public ResponseEntity<ProfileResponse> getProfile(
            @AuthenticationPrincipal CustomUserDetails me
    ) {
        return ResponseEntity.ok(userProfileService.getProfile(me.getUser().getId()));
    }

    @PutMapping
    public ResponseEntity<ProfileResponse> updateProfile(
            @AuthenticationPrincipal CustomUserDetails me,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(userProfileService.updateProfile(me.getUser().getId(), request));
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal CustomUserDetails me,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        userProfileService.changePassword(me.getUser().getId(), request);
        return ResponseEntity.noContent().build();
    }
}