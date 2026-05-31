package com.bss.backend_bss.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body of PUT /api/user/profile — a user editing their own account.
 *
 * Only display name and email are editable here. username, role, and status
 * are structural / admin-controlled and not exposed for self-service edits.
 * Both fields are optional; a blank value clears the column.
 */
@Data
public class UpdateProfileRequest {

    @Size(max = 255, message = "Display name must be at most 255 characters")
    private String displayName;

    @Email(message = "Must be a valid email address")
    @Size(max = 255, message = "Email must be at most 255 characters")
    private String email;
}