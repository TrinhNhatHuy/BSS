import axiosClient from './axiosClient';

/**
 * Flat (channel, source) rows for the Manage > Sources page.
 * Returns: [{ channelId, channelName, sourceName, url, priority, status }, ...]
 */
export const getChannelSources = () =>
    axiosClient.get('/api/editor/channel-sources').then(res => res.data);

export const createChannelSource = (data) =>
    axiosClient.post('/api/editor/channel-sources', data).then(res => res.data);

export const updateChannelSource = (channelId, sourceName, data) =>
    axiosClient
        .put(`/api/editor/channel-sources/${encodeURIComponent(channelId)}/${encodeURIComponent(sourceName)}`, data)
        .then(res => res.data);

export const deleteChannelSource = (channelId, sourceName) =>
    axiosClient.delete(
        `/api/editor/channel-sources/${encodeURIComponent(channelId)}/${encodeURIComponent(sourceName)}`
    );