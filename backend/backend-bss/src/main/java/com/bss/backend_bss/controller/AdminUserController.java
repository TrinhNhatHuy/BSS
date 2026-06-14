package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.admin.AdminUserResponse;
import com.bss.backend_bss.dto.admin.CreateUserRequest;
import com.bss.backend_bss.dto.admin.UpdateRoleRequest;
import com.bss.backend_bss.dto.admin.UpdateStatusRequest;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.AdminUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * ADMIN account management (URL-locked to ADMIN by SecurityConfig).
 *
 *   GET    /api/admin/users                 → search/filter (q, role, createdFrom/To), paginated
 *   POST   /api/admin/users                 → create an EDITOR/USER account
 *   PATCH  /api/admin/users/{id}/role       → change role (EDITOR | USER)
 *   PATCH  /api/admin/users/{id}/status     → enable / disable ("stop")
 *   DELETE /api/admin/users/{id}            → permanently delete
 *
 * The acting admin's id (from the JWT principal) is passed down so the service can
 * forbid self-actions; ADMIN-account targets are rejected in the service too.
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public ResponseEntity<Page<AdminUserResponse>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdTo,
            @PageableDefault(size = 20, sort = "createTime", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(adminUserService.list(q, role, createdFrom, createdTo, pageable));
    }

    @PostMapping
    public ResponseEntity<AdminUserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminUserService.create(request));
    }

    @PatchMapping("/{id}/role")
    public ResponseEntity<AdminUserResponse> setRole(
            @AuthenticationPrincipal CustomUserDetails me,
            @PathVariable Long id,
            @Valid @RequestBody UpdateRoleRequest request
    ) {
        return ResponseEntity.ok(adminUserService.setRole(id, request.getRole(), me.getUser().getId()));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AdminUserResponse> setStatus(
            @AuthenticationPrincipal CustomUserDetails me,
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request
    ) {
        return ResponseEntity.ok(adminUserService.setStatus(id, request.getStatus(), me.getUser().getId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal CustomUserDetails me,
            @PathVariable Long id
    ) {
        adminUserService.delete(id, me.getUser().getId());
        return ResponseEntity.noContent().build();
    }
}