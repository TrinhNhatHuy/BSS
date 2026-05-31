import axiosClient from './axiosClient';

/**
 * Editor Dashboard summary for a rolling window.
 *
 * @param {'day'|'week'|'month'} range
 *   day   → today
 *   week  → last 7 days
 *   month → last 30 days
 *
 * Returns {
 *   range, dateFrom, dateTo, totalChannels,
 *   metrics: { schedulesReady, crawlFailures, pendingReview, reschedules },
 *   programsByChannel: [{ channelId, channelName, programs }],
 *   recentReschedules: [RescheduleLogResponse]
 * }
 */
export const getEditorDashboardSummary = (range = 'day') =>
    axiosClient
        .get('/api/editor/dashboard/summary', { params: { range } })
        .then(res => res.data);