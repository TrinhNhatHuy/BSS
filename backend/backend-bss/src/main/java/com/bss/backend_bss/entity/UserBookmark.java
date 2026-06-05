package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps to the existing {@code user_bookmark} table.
 *
 * One row per (user, saved program). Unique on (user_id, program_id). Inserted
 * and deleted only, never updated — hence just a @PrePersist hook.
 */
@Entity
@Table(name = "user_bookmark")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBookmark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
    }
}