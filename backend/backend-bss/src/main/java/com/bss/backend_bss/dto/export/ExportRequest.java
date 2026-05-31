package com.bss.backend_bss.dto.export;

import lombok.Data;

import java.util.List;

/**
 * Query parameters for GET /api/editor/export/xlsx.
 *
 * Spring MVC binds query params to this object via @ModelAttribute. Repeated
 * {@code channelIds} params (?channelIds=VTV1&channelIds=VTV3) bind to the list.
 *
 * Date filters are ISO yyyy-MM-dd and are translated into the same
 * YYYYMMDDHHMMSS-prefix string comparisons the program list endpoint uses, so
 * they line up with begin_time exactly. All fields are optional.
 */
@Data
public class ExportRequest {

    /** Channels to export. Empty / null → every channel in the system. */
    private List<String> channelIds;

    /** ISO yyyy-MM-dd — only programs whose begin_time >= this date. */
    private String dateFrom;

    /** ISO yyyy-MM-dd — only programs whose begin_time <= this date (end-of-day). */
    private String dateTo;

    /**
     * Include the live / published schedule (program rows with
     * draft_batch_id IS NULL). Defaults to true when omitted.
     */
    private Boolean includePrograms;

    /**
     * Also include draft programs (draft_batch_id IS NOT NULL) — the pending
     * AI / editor review rows. Defaults to false.
     */
    private Boolean includeDrafts;

    /**
     * Add a second sheet with the reschedule activity log for the selected
     * channels. Defaults to false.
     */
    private Boolean includeLogs;

    // --- null-safe accessors: the "include" flags default sensibly ---

    public boolean wantsPrograms() {
        return includePrograms == null || includePrograms;
    }

    public boolean wantsDrafts() {
        return Boolean.TRUE.equals(includeDrafts);
    }

    public boolean wantsLogs() {
        return Boolean.TRUE.equals(includeLogs);
    }
}