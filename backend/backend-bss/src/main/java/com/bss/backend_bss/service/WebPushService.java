package com.bss.backend_bss.service;

import com.bss.backend_bss.entity.PushSubscription;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.GeneralSecurityException;
import java.security.Security;

/**
 * Sends Web Push messages signed with our VAPID key pair. No third-party
 * account or per-message cost: we push directly to the browser's push service
 * (FCM/Mozilla/Apple) named by each subscription's endpoint.
 *
 * Disabled gracefully if VAPID keys aren't configured — {@link #isEnabled()}
 * returns false and sends become no-ops, so the app still runs without push.
 */
@Slf4j
@Service
public class WebPushService {

    private final String publicKey;
    private final String privateKey;
    private final String subject;

    private PushService pushService;

    public WebPushService(
            @Value("${app.webpush.public-key:}") String publicKey,
            @Value("${app.webpush.private-key:}") String privateKey,
            @Value("${app.webpush.subject:mailto:admin@bss.local}") String subject) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
    }

    @PostConstruct
    void init() {
        if (publicKey == null || publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            log.warn("Web Push disabled: VAPID keys not configured (app.webpush.public-key / private-key).");
            return;
        }
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        try {
            this.pushService = new PushService(publicKey, privateKey, subject);
            log.info("Web Push enabled (VAPID).");
        } catch (GeneralSecurityException e) {
            log.error("Failed to initialise Web Push; push notifications disabled: {}", e.getMessage());
        }
    }

    public boolean isEnabled() {
        return pushService != null;
    }

    /** The VAPID public key the frontend needs to subscribe. */
    public String getPublicKey() {
        return publicKey;
    }

    /**
     * Push a JSON payload to one subscription.
     *
     * @return {@code true} if the subscription is still valid (keep it),
     *         {@code false} if the push service reports it gone (404/410 — prune it).
     */
    public boolean send(PushSubscription sub, String payloadJson) {
        if (pushService == null) return true; // push disabled — nothing to prune
        try {
            Subscription subscription = new Subscription(
                    sub.getEndpoint(),
                    new Subscription.Keys(sub.getP256dh(), sub.getAuth()));
            HttpResponse response = pushService.send(new Notification(subscription, payloadJson));
            int status = response.getStatusLine().getStatusCode();
            if (status == 404 || status == 410) {
                log.info("Push endpoint gone (HTTP {}); pruning subscription {}", status, sub.getId());
                return false;
            }
            if (status >= 400) {
                log.warn("Web Push send returned HTTP {} for subscription {}", status, sub.getId());
            }
            return true;
        } catch (Exception e) {
            // Transient failure — keep the subscription and try again next time.
            log.warn("Web Push send failed for subscription {}: {}", sub.getId(), e.getMessage());
            return true;
        }
    }
}