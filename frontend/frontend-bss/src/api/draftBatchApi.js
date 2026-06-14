import axiosClient from './axiosClient';

/**
 * Editor APIs for AI draft batches (the review side of "Clean with AI").
 *
 * The drafts themselves are created by the n8n workflow (see aiApi.js); these
 * endpoints — served by our Spring backend off the shared Postgres — let the
 * editor list, review, delete, and approve them. Individual draft programs are
 * edited/removed through programApi.js (updateProgram / deleteProgram), which
 * work on any program regardless of draft status.
 */

/**
 * Pending (not-yet-approved) draft batches, newest first.
 * Pass a channelId for one channel (ViewChannel panel); omit it for every
 * channel (the Drafts by AI page).
 */
export const getDraftBatches = (channelId) =>
    axiosClient
        .get('/api/editor/draft-batches', { params: channelId ? { channelId } : {} })
        .then((res) => res.data);

/** One draft batch plus its cleaned programs — backs the review modal. */
export const getDraftBatch = (id) =>
    axiosClient.get(`/api/editor/draft-batches/${id}`).then((res) => res.data);

/** Delete an entire draft batch (cascade-removes its programs). */
export const deleteDraftBatch = (id) =>
    axiosClient.delete(`/api/editor/draft-batches/${id}`);

/**
 * Approve a draft: the cleaned programs replace the live schedule for the
 * day(s) they cover and the batch is marked APPROVED.
 */
export const approveDraftBatch = (id) =>
    axiosClient.post(`/api/editor/draft-batches/${id}/approve`);