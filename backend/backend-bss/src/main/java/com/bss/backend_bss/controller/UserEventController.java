package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.LogEventRequest;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.UserEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Records the caller's implicit interactions (program views/clicks/watches and
 * searches) that feed the personalized home page. Fire-and-forget from the client
 * — always returns 204 and never blocks the UI.
 *
 *   POST /api/user/events   body { type, programId? , keyword? }
 */
@RestController
@RequestMapping("/api/user/events")
@RequiredArgsConstructor
public class UserEventController {

    private final UserEventService userEventService;

    @PostMapping
    public ResponseEntity<Void> log(
            @AuthenticationPrincipal CustomUserDetails me,
            @Valid @RequestBody LogEventRequest request
    ) {
        userEventService.record(me.getUser().getId(), request);
        return ResponseEntity.noContent().build();
    }
}