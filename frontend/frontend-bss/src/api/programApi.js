import axiosClient from './axiosClient';

/**
 * Paginated, filterable program list for the editor index page.
 *
 * filter = { name?, content?, channelId?, category?, dateFrom?, dateTo?, status? }
 * sort   = e.g. "beginTime,asc" — defaults to begin_time ASC on the server.
 */
export const getPrograms = (filter = {}, page = 0, size = 20, sort) => {
    const params = { page, size };
    if (sort) params.sort = sort;
    Object.entries(filter).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params[k] = v;
    });
    return axiosClient.get('/api/editor/programs', { params }).then(res => res.data);
};

/** Category enum values, for the filter dropdown. */
export const getProgramCategories = () =>
    axiosClient.get('/api/editor/programs/categories').then(res => res.data);

/** Single program by id — backs the program detail page. */
export const getProgramById = (id) =>
    axiosClient.get(`/api/editor/programs/${id}`).then(res => res.data);

/**
 * Edit a program. data = { name, content, category, beginTime, endTime }
 * with the times as 14-char YYYYMMDDHHMMSS strings.
 */
export const updateProgram = (id, data) =>
    axiosClient.put(`/api/editor/programs/${id}`, data).then(res => res.data);

/** Permanently delete a program. */
export const deleteProgram = (id) =>
    axiosClient.delete(`/api/editor/programs/${id}`);

/**
 * Live (non-draft) programs aired on a given date for a channel.
 * Used by the ViewChannel detail page.
 *
 * @param channelId e.g. "VTV1"
 * @param date ISO yyyy-MM-dd (defaults to today on the server if omitted)
 */
export const getProgramsForChannel = (channelId, date) =>
    axiosClient.get('/api/editor/programs/by-channel', {
        params: { channelId, ...(date ? { date } : {}) }
    }).then(res => res.data);