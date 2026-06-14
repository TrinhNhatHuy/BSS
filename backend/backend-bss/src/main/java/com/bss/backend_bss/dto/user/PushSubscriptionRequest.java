package com.bss.backend_bss.dto.user;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** The browser PushSubscription, sent from the service worker after subscribe. */
@Data
public class PushSubscriptionRequest {

    @NotBlank
    private String endpoint;

    @NotBlank
    private String p256dh;

    @NotBlank
    private String auth;
}