package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps to the existing {@code user_preference} table.
 *
 * One row per (user, favourite category). A user picks 1–2 categories during
 * onboarding; the home page uses them as the default chip filter. The
 * {@code category} reuses {@link Program.Category} so the enum stays in one place.
 *
 * No update_time column / trigger on this table — rows are inserted/deleted,
 * never updated — so there is only a @PrePersist hook.
 */
@Entity
@Table(name = "user_preference")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 20)
    private Program.Category category;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
    }
}
