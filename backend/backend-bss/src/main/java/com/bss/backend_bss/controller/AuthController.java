package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.*;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Public auth endpoints — all under /api/auth/** (permitted in SecurityConfig).
 *
 * Endpoints:
 *   POST /api/auth/login     → authenticate, returns JWT + user info
 *   POST /api/auth/register  → create USER account, returns JWT + user info
 *   GET  /api/auth/me        → verify token + return current user info
 *                              (this one IS protected — requires valid JWT)
 *
 * The controller is intentionally thin — all logic lives in AuthService.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // POST /api/auth/login

    /**
     * Authenticates a user and returns a JWT.
     *
     * Request body:
     *   { "username": "editor1", "password": "editor123" }
     *
     * Success response (200):
     *   {
     *     "token": "eyJhbGciOiJIUzI1NiJ9...",
     *     "username": "editor1",
     *     "displayName": "Editor One",
     *     "role": "EDITOR",
     *     "expiresIn": 86400000
     *   }
     *
     * Failure responses:
     *   401 — invalid username or password
     *   401 — account disabled
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    // POST /api/auth/register

    /**
     * Registers a new USER-role account.
     *
     * Request body:
     *   {
     *     "username": "newuser",
     *     "email": "newuser@example.com",
     *     "password": "securepass123",
     *     "displayName": "New User"          ← optional
     *   }
     *
     * Success response (201 Created):
     *   Same shape as login — token is returned so the user is logged in
     *   immediately after registration without a second request.
     *
     * Failure responses:
     *   400 — validation errors (blank fields, short password, bad email format)
     *   409 — username or email already exists
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // GET /api/auth/me

    /**
     * Returns info about the currently authenticated user.
     *
     * Used by the React app on every page load / browser refresh to:
     *   1. Confirm the stored token is still valid.
     *   2. Rehydrate the user state (username, role, displayName) from the server
     *      without requiring a full re-login.
     *
     * Requires: Authorization: Bearer <token>
     *
     * Success response (200):
     *   {
     *     "id": 1,
     *     "username": "editor1",
     *     "displayName": "Editor One",
     *     "email": "editor1@bss.local",
     *     "role": "EDITOR"
     *   }
     *
     * Failure:
     *   401 — no token, expired token, or invalid token
     *         (handled by JwtAuthFilter — request never reaches this method)
     *
     * NOTE: /api/auth/me is inside /api/auth/** which is permitted in SecurityConfig,
     * but JwtAuthFilter still runs for it (shouldNotFilter() excludes /api/auth/** from
     * the filter). So we add @AuthenticationPrincipal — if no valid token is present
     * the principal will be null and we return 401 explicitly.
     *
     * Actually a cleaner approach: move /me to a protected path like /api/users/me
     * and let SecurityConfig's .anyRequest().authenticated() handle the 401.
     * But keeping it under /api/auth/ makes it easier to find during development.
     */
    @GetMapping("/me")
    public ResponseEntity<UserInfoResponse> getCurrentUser(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails == null) {
            // Token missing or invalid — JwtAuthFilter didn't set SecurityContext
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(authService.getCurrentUserInfo(userDetails));
    }
}