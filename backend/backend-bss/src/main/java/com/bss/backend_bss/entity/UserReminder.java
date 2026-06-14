package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * A user's reminder for a single program.
 *
 * {@code remindAt} is the absolute wall-clock time to notify, computed at save
 * time as (program start − {@code minutesBefore}) in the app's reminder time
 * zone. The scheduler polls for rows with {@code isSent = false} whose
 * {@code remindAt} has passed. One reminder per (user, program).
 */
@Entity
@Table(name = "user_reminder")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserReminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Column(name = "remind_at", nullable = false)
    private LocalDateTime remindAt;

    @Column(name = "minutes_before", nullable = false)
    private Integer minutesBefore;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 20)
    private Channel channel;

    @Column(name = "is_sent", nullable = false)
    private Boolean isSent;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
        this.updateTime = LocalDateTime.now();
        if (this.isSent == null) this.isSent = false;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updateTime = LocalDateTime.now();
    }

    /** Which delivery channel(s) to use when the reminder fires. */
    public enum Channel {
        WEBPUSH,
        TELEGRAM,
        BOTH
    }
}