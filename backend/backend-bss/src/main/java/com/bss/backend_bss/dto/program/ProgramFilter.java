package com.bss.backend_bss.dto.program;

import com.bss.backend_bss.entity.Program;
import lombok.Data;

/**
 * Query parameters for GET /api/editor/programs.
 *
 * Spring MVC binds query params to this object automatically via @ModelAttribute.
 * All fields are nullable — null means "don't filter on this".
 *
 * Date filters are ISO yyyy-MM-dd. The service translates them into
 * YYYYMMDDHHMMSS-prefix string comparisons against begin_time.
 */
@Data
public class ProgramFilter {

    /** Substring match on program.name (case-insensitive). */
    private String name;

    /** Substring match on program.content (case-insensitive). */
    private String content;

    /** Exact match on channel_id. */
    private String channelId;

    /** Exact match on category. */
    private Program.Category category;

    /** ISO yyyy-MM-dd — only programs whose begin_time >= this date. */
    private String dateFrom;

    /** ISO yyyy-MM-dd — only programs whose begin_time <= this date (end-of-day). */
    private String dateTo;

    /**
     * "live"   → only programs with draft_batch_id IS NULL
     * "draft"  → only programs with draft_batch_id IS NOT NULL
     * null/""  → both
     */
    private String status;
}