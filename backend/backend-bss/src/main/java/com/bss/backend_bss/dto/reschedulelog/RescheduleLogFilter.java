package com.bss.backend_bss.dto.reschedulelog;

import com.bss.backend_bss.entity.RescheduleLog;
import lombok.Data;

/**
 * Query parameters for GET /api/editor/reschedule-logs.
 *
 * Spring MVC binds query params to this object via @ModelAttribute.
 * All fields are nullable — null/blank means "don't filter on this".
 */
@Data
public class RescheduleLogFilter {

    /**
     * Case-insensitive substring match against the program name — checks both
     * the new name and the original name so a log shows up regardless of status.
     */
    private String q;

    /** Exact match on channel_id. */
    private String channelId;

    /** Exact match on status (ADDED | MODIFIED | DELETED). */
    private RescheduleLog.Status status;

    /** ISO yyyy-MM-dd — only logs created on or after the start of this day. */
    private String dateFrom;

    /** ISO yyyy-MM-dd — only logs created on or before the end of this day. */
    private String dateTo;
}