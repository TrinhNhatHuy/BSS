package com.bss.backend_bss.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "source")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Source {

    @Id
    @Column(name = "name", length = 50)
    private String name;

    @Column(name = "url", length = 500)
    private String url;

    @Column(name = "status", nullable = false)
    private Boolean status;

    /**
     * Global priority for this source. Lower = higher priority.
     * Added in the v2 migration. Nullable for sources with no priority set.
     */
    @Column(name = "priority")
    private Integer priority;

    @Column(name = "create_time")
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @PrePersist
    protected void onCreate() {
        this.createTime = LocalDateTime.now();
        this.updateTime = LocalDateTime.now();
        if (this.status == null) this.status = true;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updateTime = LocalDateTime.now();
    }
}