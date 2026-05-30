package com.bss.backend_bss.dto.reschedulelog;

import com.bss.backend_bss.entity.RescheduleLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Returned by GET /api/editor/reschedule-logs (paginated index).
 *
 * Carries both the new and original program fields so the frontend can render a
 * per-field old → new comparison without a second request.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RescheduleLogResponse {

    private Long id;

    private String channelId;
    /** Resolved channel.name — null if the channel row no longer exists. */
    private String channelName;

    private RescheduleLog.Status status;

    private String beginTime;
    private String endTime;
    private String name;
    private String content;

    private String originalBeginTime;
    private String originalEndTime;
    private String originalName;
    private String originalContent;

    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}