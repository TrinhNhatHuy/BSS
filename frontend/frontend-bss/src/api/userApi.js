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