package com.bss.backend_bss.controller;

import com.bss.backend_bss.dto.user.PushSubscriptionRequest;
import com.bss.backend_bss.security.CustomUserDetails;
import com.bss.backend_bss.service.PushSubscriptionService;
import com.bss.backend_bss.service.WebPushService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Web Push subscription management for the current user's devices.
 *
 *   GET    /api/user/push/public-key  → { enabled, publicKey } for the frontend to subscribe
 *   POST   /api/user/push/subscribe   → store this device's subscription
 *   DELETE /api/user/push/subscribe   → remove a subscription by endpoint
 */
@RestController
@RequestMapping("/api/user/push")
@RequiredArgsConstructor
public class PushSubscriptionController {

    private final PushSubscriptionService pushSubscriptionService;
    private final WebPushService webPushService;

    @GetMapping("/public-key")
    public ResponseEntity<Map<String, Object>> publicKey() {
        return ResponseEntity.ok(Map.of(
                "enabled", webPushService.isEnabled(),
                "publicKey", webPushService.getPublicKey() == null ? "" : webPushService.getPublicKey()
        ));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(
            @AuthenticationPrincipal CustomUserDetails me,
            @Valid @RequestBody PushSubscriptionRequest request,
            @RequestHeader(value = "User-Agent", required = false) String userAgent
    ) {
        pushSubscriptionService.subscribe(me.getUser().getId(), request, userAgent);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/subscribe")
    public ResponseEntity<Void> unsubscribe(@RequestParam String endpoint) {
        pushSubscriptionService.unsubscribe(endpoint);
        return ResponseEntity.noContent().build();
    }
}