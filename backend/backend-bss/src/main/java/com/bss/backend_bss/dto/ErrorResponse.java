package com.bss.backend_bss.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Standardised error shape returned by GlobalExceptionHandler.
 * Every error the frontend receives looks like this — no Spring default
 * whitepage errors leak through.
 *
 * Example 401 response body:
 * {
 *   "status": 401,
 *   "message": "Invalid username or password",
 *   "timestamp": "2026-05-17T10:30:00"
 * }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponse {

    private int status;
    private String message;
    private LocalDateTime timestamp;
}