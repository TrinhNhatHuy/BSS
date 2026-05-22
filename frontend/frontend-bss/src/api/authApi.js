import axiosClient from './axiosClient';

/**
 * All API calls related to authentication.
 * Components never import axiosClient directly — they go through these functions.
 */

/**
 * POST /api/auth/login
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ token, username, displayName, role, expiresIn }>}
 */
export const loginApi = (credentials) =>
    axiosClient.post('/api/auth/login', credentials).then((res) => res.data);

/**
 * POST /api/auth/register
 * @param {{ username: string, email: string, password: string, displayName?: string }} data
 * @returns {Promise<{ token, username, displayName, role, expiresIn }>}
 */
export const registerApi = (data) =>
    axiosClient.post('/api/auth/register', data).then((res) => res.data);

/**
 * GET /api/auth/me
 * Called on app load to verify a stored token is still valid
 * and rehydrate the user object without a full re-login.
 * @returns {Promise<{ id, username, displayName, email, role }>}
 */
export const getMeApi = () =>
    axiosClient.get('/api/auth/me').then((res) => res.data);