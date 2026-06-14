package com.bss.backend_bss.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A reminder as shown to the user. Carries enough program context to render a
 * "my reminders" row without a second lookup.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReminderResponse {
    private Long programId;
    private Integer minutesBefore;
    private String channel;       // WEBPUSH | TELEGRAM | BOTH
    private String remindAt;      // ISO local date-time, e.g. "2026-06-06T05:50:00"
    private boolean sent;
    private String programName;
    private String beginTime;     // YYYYMMDDHHMMSS
    private String channelName;
}