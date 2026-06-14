package com.bss.backend_bss.dto.admin;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Change an account's role (EDITOR | USER) on the ADMIN Accounts page. */
@Data
public class UpdateRoleRequest {

    @NotBlank(message = "Role is required")
    private String role; // EDITOR | USER
}