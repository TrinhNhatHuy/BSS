package com.bss.backend_bss.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body of PUT /api/user/profile/password.
 *
 * The current password is re-verified server-side before the change is applied.
 */
@Data
public class ChangePasswordRequest {

    @NotBlank(message = "Current password is required")
    private String currentPassword;

    @NotBlank(message = "New password is required")
    @Size(min = 6, max = 100, message = "New password must be 6-100 characters")
    private String newPassword;
}