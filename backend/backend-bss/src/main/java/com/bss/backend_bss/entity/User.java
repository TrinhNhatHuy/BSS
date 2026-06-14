package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps to the existing `users` table defined in bss-db-schema.sql.
 *
 * ddl-auto=validate means Hibernate will CHECK that this entity
 * matches the real table columns — it will never alter the DB.
 */
@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", nullable = false, unique = true, length = 100)
    private String username;

    /**
     * BCrypt-hashed password. Never serialised to JSON (see AuthResponse DTO).
     * Nullable in DB to allow future SSO / OAuth accounts with no local password.
     */
    @Column(name = "password", length = 255)
    private String password;

    @Column(name = "email", unique = true, length = 255)
    private String email;

    @Column(name = "display_name", length = 255)
    private String displayName;

    /**
     * Stored as VARCHAR(20) in Postgres with a CHECK constraint.
     * EnumType.STRING writes "ADMIN" / "EDITOR" / "USER" — matching the CHECK.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;

    /**
     * FALSE = soft-deleted or banned. The JwtAuthFilter will reject tokens
     * for disabled users (via UserDetails.isEnabled()).
     */
    @Column(name = "status", nullable = false)
    private Boolean status = true;

    /**
     * Telegram chat id to deliver reminders to, set once the user links their
     * account by pressing Start on the bot. Null = not connected.
     */
    @Column(name = "telegram_chat_id", length = 50)
    private String telegramChatId;

    /**
     * One-time code embedded in the bot deep link; matched when the user starts
     * the bot to bind {@link #telegramChatId}. Cleared after a successful link.
     */
    @Column(name = "telegram_link_code", length = 20)
    private String telegramLinkCode;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    // Lifecycle callbacks

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
        this.updateTime = LocalDateTime.now();
    }

    /**
     * NOTE: The DB also has a trigger (trg_users_update_time) that stamps
     * update_time on every UPDATE. The @PreUpdate here keeps the Java object
     * in sync so you don't need a re-fetch after save().
     */
    @PreUpdate
    protected void onUpdate() {
        this.updateTime = LocalDateTime.now();
    }

    // Role enum

    public enum Role {
        ADMIN,
        EDITOR,
        USER
    }
}