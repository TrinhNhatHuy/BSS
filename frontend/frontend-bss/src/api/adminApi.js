import axiosClient from './axiosClient';

/**
 * ADMIN account-management APIs (/api/admin/users). ADMIN-only on the server.
 */

/**
 * Paginated account search. filter = { q?, role?, createdFrom?, createdTo? }
 * (createdFrom/To are ISO yyyy-MM-dd). Returns a Spring Page
 * ({ content, totalPages, totalElements, number, ... }).
 */
export const listUsers = (filter = {}, page = 0, size = 20) => {
    const params = { page, size };
    Object.entries(filter).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params[k] = v;
    });
    return axiosClient.get('/api/admin/users', { params }).then((res) => res.data);
};

/** Create an EDITOR/USER account. body = { username, email, password, displayName, role }. */
export const createUser = (body) =>
    axiosClient.post('/api/admin/users', body).then((res) => res.data);

/** Change an account's role. role = 'EDITOR' | 'USER'. */
export const updateUserRole = (id, role) =>
    axiosClient.patch(`/api/admin/users/${id}/role`, { role }).then((res) => res.data);

/** Enable (true) or disable/"stop" (false) an account. */
export const updateUserStatus = (id, status) =>
    axiosClient.patch(`/api/admin/users/${id}/status`, { status }).then((res) => res.data);

/** Permanently delete an account. */
export const deleteUser = (id) =>
    axiosClient.delete(`/api/admin/users/${id}`).then((res) => res.data);