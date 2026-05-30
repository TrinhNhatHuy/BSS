package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps to the `reschedule_log` table — an immutable audit trail of schedule
 * changes (added / modified / deleted programs), produced by the automated
 * reschedule pipeline and manual edits.
 *
 * begin_time / end_time / original_begin_time / original_end_time are stored as
 * 14-char YYYYMMDDHHMMSS strings, matching the program table. The frontend
 * formats them for display.
 *
 * Field semantics by status:
 *   ADDED    → begin_time/end_time/name/content describe the new program;
 *              the original_* fields are null.
 *   MODIFIED → begin_time/... hold the new values, original_* the previous ones.
 *   DELETED  → original_* hold the removed program's values; begin_time/... null.
 */
@Entity
@Table(name = "reschedule_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RescheduleLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "channel_id", length = 255)
    private String channelId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status;

    @Column(name = "begin_time", length = 14)
    private String beginTime;

    @Column(name = "end_time", length = 14)
    private String endTime;

    @Column(name = "name", length = 500)
    private String name;

    @Column(name = "content", length = 500)
    private String content;

    @Column(name = "original_begin_time", length = 14)
    private String originalBeginTime;

    @Column(name = "original_end_time", length = 14)
    private String originalEndTime;

    @Column(name = "original_name", length = 500)
    private String originalName;

    @Column(name = "original_content", length = 500)
    private String originalContent;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
        this.updateTime = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updateTime = LocalDateTime.now();
    }

    public enum Status {
        ADDED, MODIFIED, DELETED
    }
}