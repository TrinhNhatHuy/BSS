import axiosClient from './axiosClient';

export const getChannels = (filter = {}, page = 0, size = 20) => {
    // Strip empty values so the backend doesn't try to bind blank strings to enums
    const params = { page, size };
    Object.entries(filter).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params[k] = v;
    });
    return axiosClient.get('/api/editor/channels', { params }).then(res => res.data);
};

export const getExportTypes = () =>
    axiosClient.get('/api/editor/channels/export-types').then(res => res.data);

/** Channel groups for the picker dropdown: [{ id, name }]. */
export const getChannelGroups = () =>
    axiosClient.get('/api/editor/channel-groups').then(res => res.data);

export const getChannelById = (id) =>
    axiosClient.get(`/api/editor/channels/${id}`).then(res => res.data);

export const createChannel = (data) =>
    axiosClient.post('/api/editor/channels', data).then(res => res.data);

export const updateChannel = (id, data) =>
    axiosClient.put(`/api/editor/channels/${id}`, data).then(res => res.data);

/** Rename a channel's primary key. Child rows cascade to the new id server-side. */
export const renameChannel = (id, newId) =>
    axiosClient.put(`/api/editor/channels/${id}/rename`, { newId }).then(res => res.data);

export const deleteChannel = (id) =>
    axiosClient.delete(`/api/editor/channels/${id}`);