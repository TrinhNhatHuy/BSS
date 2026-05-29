package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Maps to the `channel` table.
 *
 * Note: channel.id is a string (e.g. "ANGIANG1", "VTV1"), not auto-generated.
 * The editor types it in when creating a channel, so we use @Id without @GeneratedValue.
 */
@Entity
@Table(name = "channel")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Channel {

    @Id
    @Column(name = "id", length = 255)
    private String id;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    /**
     * Stored as raw FK value (not a @ManyToOne) to keep the entity small and
     * avoid lazy-loading the group on every channel fetch. We expose the group
     * name in DTOs by joining in the service layer when needed.
     */
    @Column(name = "channel_group_id")
    private Long channelGroupId;

    @Column(name = "number_of_reschedules", nullable = false)
    private Integer numberOfReschedules;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_update_status", nullable = false, length = 20)
    private AiUpdateStatus aiUpdateStatus;

    @Column(name = "last_ai_update_time")
    private LocalDateTime lastAiUpdateTime;

    @Column(name = "last_ai_update_by")
    private Long lastAiUpdateBy;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    /**
     * Channel <-> ChannelExportId relationship.
     * orphanRemoval=true means clearing the collection deletes the rows.
     * This lets the update endpoint do `channel.setExportIds(newSet)` and have
     * the old rows automatically removed.
     */
    @OneToMany(mappedBy = "channel", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private Set<ChannelExportId> exportIds = new HashSet<>();

    /**
     * Channel <-> Source via channel_source junction (read-only here).
     * We don't manage this through Channel — it's managed separately via
     * ChannelSource entity so we can attach extra metadata later.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "channel_source",
            joinColumns = @JoinColumn(name = "channel_id"),
            inverseJoinColumns = @JoinColumn(name = "source_name")
    )
    @Builder.Default
    private Set<Source> sources = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
        this.updateTime = LocalDateTime.now();
        if (this.numberOfReschedules == null) this.numberOfReschedules = 0;
        if (this.aiUpdateStatus == null) this.aiUpdateStatus = AiUpdateStatus.NOT_UPDATED;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updateTime = LocalDateTime.now();
    }

    public enum AiUpdateStatus {
        NOT_UPDATED,
        UPDATED
    }
}