// ============================================================
// FILE: dto/LoginRequest.java
// ============================================================
package com.bss.backend_bss.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;
}


