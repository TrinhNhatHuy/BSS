package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps to the {@code user_event} table — a unified, insert-only log of a user's
 * implicit interactions that powers the personalized home page.
 *
 * One row per behavioral signal: a program opened ({@code VIEW}), a card clicked
 * ({@code CLICK}), a "Watch on tv360" press ({@code WATCH}), or a search typed
 * ({@code SEARCH}). Bookmarks and reminders are NOT recorded here — they live in
 * their own tables (UI state + the strongest explicit signals) and the recommender
 * reads them alongside these events.
 *
 * {@code channelId}/{@code category}/{@code beginTime}/{@code programName} are
 * SNAPSHOT at event time so the signal survives the per-airing rotation of program
 * rows (the program may later be deleted → {@code programId} set NULL, but the
 * snapshot columns remain analyzable). Insert-only, so only a @PrePersist hook.
 */
@Entity
@Table(name = "user_event")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 20)
    private EventType eventType;

    @Column(name = "program_id")
    private Long programId;

    @Column(name = "channel_id", length = 255)
    private String channelId;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", length = 20)
    private Program.Category category;

    @Column(name = "begin_time", length = 14)
    private String beginTime;

    @Column(name = "program_name", length = 500)
    private String programName;

    @Column(name = "keyword", length = 255)
    private String keyword;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @PrePersist
    protected void onCreate() {
        if (this.createTime == null) this.createTime = LocalDateTime.now();
    }

    /** Implicit interaction kinds, ordered loosely by intent strength. */
    public enum EventType {
        VIEW, CLICK, WATCH, SEARCH
    }
}