package com.bss.backend_bss.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Returned by GET /api/auth/me.
 *
 * The frontend calls this endpoint on page load (after a browser refresh)
 * to verify the stored token is still valid and rehydrate the user state
 * without making the user log in again.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInfoResponse {

    private Long id;
    private String username;
    private String displayName;
    private String email;
    private String role;
}