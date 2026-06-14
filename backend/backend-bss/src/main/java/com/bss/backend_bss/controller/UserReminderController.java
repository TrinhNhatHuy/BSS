package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.ReminderRequest;
import com.bss.backend_bss.dto.user.ReminderResponse;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.ReminderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Program reminders for the current user.
 *
 *   GET    /api/user/reminders             → all of the caller's reminders
 *   GET    /api/user/reminders/{programId} → one (204 if none)
 *   POST   /api/user/reminders             → create/update (upsert by program)
 *   DELETE /api/user/reminders/{programId} → remove
 */
@RestController
@RequestMapping("/api/user/reminders")
@RequiredArgsConstructor
public class UserReminderController {

    private final ReminderService reminderService;

    @GetMapping
    public ResponseEntity<List<ReminderResponse>> list(@AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(reminderService.list(me.getUser().getId()));
    }

    @GetMapping("/{programId}")
    public ResponseEntity<ReminderResponse> get(
            @AuthenticationPrincipal CustomUserDetails me,
            @PathVariable Long programId
    ) {
        return reminderService.get(me.getUser().getId(), programId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    public ResponseEntity<ReminderResponse> upsert(
            @AuthenticationPrincipal CustomUserDetails me,
            @Valid @RequestBody ReminderRequest request
    ) {
        return ResponseEntity.ok(reminderService.upsert(me.getUser().getId(), request));
    }

    @DeleteMapping("/{programId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal CustomUserDetails me,
            @PathVariable Long programId
    ) {
        reminderService.delete(me.getUser().getId(), programId);
        return ResponseEntity.noContent().build();
    }
}