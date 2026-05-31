package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Returned by the self-service account endpoints under /api/user/profile.
 *
 * Richer than {@code UserInfoResponse} (used by /api/auth/me) — it also exposes
 * status and timestamps for the Account Settings page. The password is never
 * included.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileResponse {
    private Long id;
    private String username;
    private String email;
    private String displayName;
    private String role;
    private Boolean status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}