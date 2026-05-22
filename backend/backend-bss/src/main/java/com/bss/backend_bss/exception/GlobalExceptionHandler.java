package com.bss.backend_bss.exception;

import com.bss.backend_bss.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

/**
 * Single place for all exception-to-HTTP-response mappings.
 *
 * Without this, Spring would return its default whitepage HTML on errors,
 * which the React frontend cannot parse. Every error the frontend receives
 * is now a consistent ErrorResponse JSON object.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Auth-specific errors
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(InvalidCredentialsException ex) {
        log.warn("Authentication failure: {}", ex.getMessage());
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler(UserAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleUserAlreadyExists(UserAlreadyExistsException ex) {
        return build(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ErrorResponse> handleDisabled(DisabledException ex) {
        return build(HttpStatus.UNAUTHORIZED, "Your account has been disabled. Contact an administrator.");
    }

    // Spring Security access denial

    /**
     * Thrown by Spring Security when a user is authenticated but lacks the
     * required role for an endpoint (403 Forbidden).
     *
     * Note: Spring Security has its own AccessDeniedHandler that runs BEFORE
     * @RestControllerAdvice for filter-level exceptions. This handler covers
     * cases thrown inside controllers/services annotated with @PreAuthorize.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, "You do not have permission to access this resource.");
    }

    // Validation errors
    /**
     * Triggered by @Valid on request body DTOs.
     * Collects all field errors and returns them as a single message string.
     *
     * Example: "password: Password must be at least 8 characters; username: Username is required"
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        return build(HttpStatus.BAD_REQUEST, message);
    }

    // Catch-all
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unhandled exception: ", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred. Please try again later.");
    }

    // Helper

    private ResponseEntity<ErrorResponse> build(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(
                ErrorResponse.builder()
                        .status(status.value())
                        .message(message)
                        .timestamp(LocalDateTime.now())
                        .build()
        );
    }
}