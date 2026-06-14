package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A Web Push subscription for one browser/device belonging to a user. Created
 * when the user grants notification permission and the service worker
 * subscribes via the Push API. A user may have several (phone, laptop, …).
 *
 * {@code endpoint} is the push service URL (FCM/Mozilla/Apple); {@code p256dh}
 * and {@code auth} are the client's encryption keys used to seal the payload.
 */
@Entity
@Table(name = "push_subscription")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "endpoint", nullable = false, length = 1000, unique = true)
    private String endpoint;

    @Column(name = "p256dh", nullable = false)
    private String p256dh;

    @Column(name = "auth", nullable = false)
    private String auth;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
    }
}