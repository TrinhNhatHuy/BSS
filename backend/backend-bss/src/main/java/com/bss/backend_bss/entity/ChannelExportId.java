package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Maps to channel_export_id table. Composite PK: (channel_id, type).
 *
 * Uses @IdClass instead of @EmbeddedId because the channel field is also the
 * FK relationship — @IdClass plays nicer with this dual role.
 */
@Entity
@Table(name = "channel_export_id")
@IdClass(ChannelExportId.PK.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = {"channel", "type"})
public class ChannelExportId {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id", nullable = false)
    private Channel channel;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 10)
    private ExportType type;

    @Column(name = "external_id", nullable = false, length = 100)
    private String externalId;

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

    public enum ExportType {
        HD, SD, None
    }

    /**
     * Composite key class required by @IdClass.
     * Field names + types must match the @Id fields on ChannelExportId.
     * For the `channel` @Id field whose type is Channel, the PK class uses the
     * channel's own ID type (String).
     */
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PK implements Serializable {
        private String channel;  // maps to Channel.id
        private ExportType type;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof PK pk)) return false;
            return Objects.equals(channel, pk.channel) && type == pk.type;
        }

        @Override
        public int hashCode() {
            return Objects.hash(channel, type);
        }
    }
}