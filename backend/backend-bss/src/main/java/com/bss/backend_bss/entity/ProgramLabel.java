package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Maps to the existing {@code program_label} table.
 *
 * Stores a category prediction/annotation for a program from a given source
 * (GEMINI, HUMAN, MODEL_V1, MODEL_V2). The unique constraint is
 * (program_id, label_source), so there is at most one row per source per program
 * — which is why upserts key on that pair.
 *
 * For our model we write {@code label_source = MODEL_V2} and stash the model's
 * confidence/margin in {@code note} (e.g. "conf=0.84;margin=2.97") for evaluation.
 */
@Entity
@Table(name = "program_label")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProgramLabel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "program_id", nullable = false)
    private Long programId;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 20)
    private Program.Category category;

    @Enumerated(EnumType.STRING)
    @Column(name = "label_source", nullable = false, length = 20)
    private LabelSource labelSource;

    @Column(name = "is_verified", nullable = false)
    private Boolean isVerified;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
        this.updateTime = LocalDateTime.now();
        if (this.isVerified == null) this.isVerified = false;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updateTime = LocalDateTime.now();
    }

    public enum LabelSource {
        GEMINI, HUMAN, MODEL_V1, MODEL_V2
    }
}
