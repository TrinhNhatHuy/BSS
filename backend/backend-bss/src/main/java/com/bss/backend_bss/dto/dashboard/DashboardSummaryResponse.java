package com.bss.backend_bss.dto.dashboard;

import com.bss.backend_bss.dto.reschedulelog.RescheduleLogResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Single payload for GET /api/editor/dashboard/summary — everything the Editor
 * Dashboard renders, computed for the selected {@code range} (day / week /
 * month). One round-trip keeps the page in sync: changing the range re-fetches
 * this whole object.
 *
 * {@link #programsByChannel} drives BOTH the per-channel bar chart and the
 * Channels Status list, so the two can never disagree.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardSummaryResponse {

    /** Echo of the requested range: "day" | "week" | "month". */
    private String range;

    /** Inclusive window start, ISO yyyy-MM-dd (begin_time of programs counted). */
    private String dateFrom;

    /** Inclusive window end, ISO yyyy-MM-dd. */
    private String dateTo;

    /** Total number of channels in the system (denominator for the % readout). */
    private int totalChannels;

    private Metrics metrics;

    /** Every channel with its live-program count in the window (count may be 0). */
    private List<ChannelProgramCount> programsByChannel;

    /** Newest reschedule-log entries, for the activity feed. */
    private List<RescheduleLogResponse> recentReschedules;

    /** The four headline figures on the metric cards. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Metrics {
        /** Channels with ≥1 live program in the window. */
        private long schedulesReady;
        /** Channels with no live program in the window (missing/failed crawl). */
        private long crawlFailures;
        /** Draft batches not yet approved (awaiting editor review). */
        private long pendingReview;
        /** Reschedule-log entries whose program date falls in the window. */
        private long reschedules;
    }

    /** One bar of the chart / one row of the Channels Status list. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChannelProgramCount {
        private String channelId;
        /** Resolved channel.name — falls back to channelId-only on the client. */
        private String channelName;
        private long programs;
    }
}