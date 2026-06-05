import axiosClient from './axiosClient';

/**
 * Paginated, filterable reschedule-log list for the editor index page.
 *
 * filter = { q?, channelId?, status?, dateFrom?, dateTo? }
 *   q       → substring match on program name (new or original)
 *   status  → 'ADDED' | 'MODIFIED' | 'DELETED'
 * sort      → e.g. "createTime,desc" — defaults to create_time DESC on the server.
 */
export const getRescheduleLogs = (filter = {}, page = 0, size = 20, sort) => {
    const params = { page, size };
    if (sort) params.sort = sort;
    Object.entries(filter).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params[k] = v;
    });
    return axiosClient.get('/api/editor/reschedule-logs', { params }).then(res => res.data);
};

/** Status enum values, for the filter dropdown. */
export const getRescheduleLogStatuses = () =>
    axiosClient.get('/api/editor/reschedule-logs/statuses').then(res => res.data);

/** A single reschedule log by id, for the change-detail page. */
export const getRescheduleLogById = (id) =>
    axiosClient.get(`/api/editor/reschedule-logs/${id}`).then(res => res.data);