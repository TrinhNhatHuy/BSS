package com.bss.backend_bss.service;

import com.bss.backend_bss.dto.user.PushSubscriptionRequest;
import com.bss.backend_bss.entity.PushSubscription;
import com.bss.backend_bss.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Persist/remove a browser's Web Push subscription (one row per device). */
@Service
@RequiredArgsConstructor
public class PushSubscriptionService {

    private final PushSubscriptionRepository repository;

    /** Upsert by endpoint so re-subscribing the same device doesn't duplicate. */
    @Transactional
    public void subscribe(Long userId, PushSubscriptionRequest req, String userAgent) {
        PushSubscription sub = repository.findByEndpoint(req.getEndpoint())
                .orElseGet(PushSubscription::new);
        sub.setUserId(userId);
        sub.setEndpoint(req.getEndpoint());
        sub.setP256dh(req.getP256dh());
        sub.setAuth(req.getAuth());
        sub.setUserAgent(userAgent);
        repository.save(sub);
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        if (endpoint != null && !endpoint.isBlank()) {
            repository.deleteByEndpoint(endpoint);
        }
    }
}