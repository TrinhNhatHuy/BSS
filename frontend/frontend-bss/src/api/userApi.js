import axiosClient from './axiosClient';

/**
 * Self-service account APIs (the logged-in user's own account).
 * All operate on the caller's row — the backend reads the id from the JWT.
 */

/** GET /api/user/profile → { id, username, email, displayName, role, status, createTime, updateTime } */
export const getProfile = () =>
    axiosClient.get('/api/user/profile').then((res) => res.data);

/** PUT /api/user/profile — data = { displayName, email } */
export const updateProfile = (data) =>
    axiosClient.put('/api/user/profile', data).then((res) => res.data);

/** PUT /api/user/profile/password — data = { currentPassword, newPassword } */
export const changePassword = (data) =>
    axiosClient.put('/api/user/profile/password', data).then((res) => res.data);


// ─── Home / recommendations (USER home page) ────────────────────────────────

/** Current favourite categories → { categories: [...] } (empty = new user). */
export const getPreferences = () =>
    axiosClient.get('/api/user/preferences').then((res) => res.data);

/** Replace favourites with 1–2 categories. */
export const setPreferences = (categories) =>
    axiosClient.put('/api/user/preferences', { categories }).then((res) => res.data);

/** The 7 category enum values. */
export const getCategories = () =>
    axiosClient.get('/api/user/categories').then((res) => res.data);

/** A day's labeled schedule + the caller's preferences + per-category counts. */
export const getHome = (date) =>
    axiosClient
        .get('/api/user/home', { params: date ? { date } : {} })
        .then((res) => res.data);

/** Bookmarked programs, newest first. */
export const getBookmarks = () =>
    axiosClient.get('/api/user/bookmarks').then((res) => res.data);

export const addBookmark = (programId) =>
    axiosClient.post(`/api/user/bookmarks/${programId}`).then((res) => res.data);

export const removeBookmark = (programId) =>
    axiosClient.delete(`/api/user/bookmarks/${programId}`).then((res) => res.data);