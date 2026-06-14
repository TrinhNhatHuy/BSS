package com.bss.backend_bss.dto.admin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * ADMIN creates a new account. {@code role} must be EDITOR or USER — ADMIN accounts
 * can't be minted from the UI (enforced in {@link com.bss.backend_bss.service.AdminUserService}).
 */
@Data
public class CreateUserRequest {

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be 3–50 characters")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email address")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    /** Optional — falls back to username if blank. */
    private String displayName;

    @NotBlank(message = "Role is required")
    private String role; // EDITOR | USER
}