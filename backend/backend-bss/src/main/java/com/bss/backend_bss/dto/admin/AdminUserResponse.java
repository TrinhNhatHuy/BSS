package com.bss.backend_bss.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** One account row on the ADMIN "Accounts" management page. Never carries the password. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserResponse {
    private Long id;
    private String username;
    private String email;
    private String displayName;
    private String role;        // ADMIN | EDITOR | USER
    private boolean status;     // true = active, false = disabled
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}