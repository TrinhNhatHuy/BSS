package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps to the `program` table.
 *
 * begin_time / end_time are stored as 14-char strings in YYYYMMDDHHMMSS format
 * (e.g., 20240115143000). We keep them as String here to match the schema —
 * the frontend formats them for display.
 *
 * Programs with draft_batch_id = NULL are the "live" / published schedule.
 */
@Entity
@Table(name = "program")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Program {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "channel_id", length = 255)
    private String channelId;

    @Column(name = "draft_batch_id")
    private Long draftBatchId;

    @Column(name = "begin_time", nullable = false, length = 14)
    private String beginTime;

    @Column(name = "end_time", nullable = false, length = 14)
    private String endTime;

    @Column(name = "name", length = 500)
    private String name;

    @Column(name = "content", length = 500)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", length = 20)
    private Category category;

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

    public enum Category {
        SeriesVN, SeriesFR, Kids, Music, Sports, News, Others
    }
}