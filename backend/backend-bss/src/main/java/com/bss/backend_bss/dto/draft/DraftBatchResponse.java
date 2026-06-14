package com.bss.backend_bss.dto.draft;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Summary of one AI draft batch — backs the "AI Draft Schedules" list on the
 * ViewChannel page. The program list itself is loaded separately
 * ({@link DraftBatchDetailResponse}) when the editor opens a draft for review.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DraftBatchResponse {
    private Long id;
    private String channelId;
    /** Resolved channel.name — null if the channel row no longer exists. */
    private String channelName;
    /** PROCESSING | COMPLETED | APPROVED. */
    private String status;
    /** The day this batch covers, as the workflow stored it (ISO yyyy-MM-dd). */
    private String programDate;
    /** Number of cleaned programs in the batch. */
    private long programCount;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}