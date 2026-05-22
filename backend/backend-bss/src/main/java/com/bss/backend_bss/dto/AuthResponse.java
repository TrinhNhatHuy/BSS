package com.bss.backend_bss.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Returned by POST /api/auth/login and POST /api/auth/register.
 *
 * The frontend stores `token` in localStorage and uses `role` to decide
 * which page to navigate to:
 *   EDITOR → /editor/dashboard
 *   ADMIN  → /admin/dashboard
 *   USER   → /user/home
 *
 * NOTE: password is NEVER included here. We always return DTOs, never
 * the raw User entity, to guarantee no accidental field leakage.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    /** Signed JWT — store in localStorage under key "bss_auth_token" */
    private String token;

    private String username;

    /** Friendly name shown in the UI header */
    private String displayName;

    /** "EDITOR" | "ADMIN" | "USER" — used by React for role-based routing */
    private String role;

    /** Milliseconds until the token expires (matches jwt.expiration-ms) */
    private long expiresIn;
}