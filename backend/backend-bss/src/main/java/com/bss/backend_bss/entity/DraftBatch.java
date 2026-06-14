package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps to the `draft_batch` table — one row per "Clean with AI" run.
 *
 * The n8n "AI Controller" workflow creates a batch (status PROCESSING), inserts
 * the Gemini-cleaned programs into the {@code program} table tagged with this
 * batch's id, then flips the batch to COMPLETED. An editor reviews the batch and
 * either deletes it (cascade-removing its programs) or approves it — at which
 * point the cleaned programs replace the live schedule for that channel+date and
 * the batch is marked APPROVED.
 *
 * Lifecycle: PROCESSING → COMPLETED → APPROVED.
 *
 * program_date is the VARCHAR the workflow writes (ISO "yyyy-MM-dd"); the actual
 * day a draft covers is also derivable from its programs' begin_time prefixes,
 * which is what the approve flow uses so it never depends on this column's format.
 */
@Entity
@Table(name = "draft_batch")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DraftBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "channel_id", length = 255, nullable = false)
    private String channelId;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private Status status;

    @Column(name = "program_date", length = 14)
    private String programDate;

    @Column(name = "approved_time")
    private LocalDateTime approvedTime;

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @PrePersist
    protected void onCreate() {
        if (this.createTime == null) this.createTime = LocalDateTime.now();
        this.updateTime = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updateTime = LocalDateTime.now();
    }

    public enum Status {
        PROCESSING, COMPLETED, APPROVED
    }
}