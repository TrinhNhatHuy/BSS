// Keys used in localStorage
const TOKEN_KEY = 'bss_auth_token';
const USER_KEY  = 'bss_auth_user';

// Token

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

// Cached user (username, role, displayName)
// Stored so the UI doesn't flash blank while /api/auth/me is verifying the token.

export const getCachedUser = () => {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const setCachedUser = (user) =>
    localStorage.setItem(USER_KEY, JSON.stringify(user));

export const removeCachedUser = () => localStorage.removeItem(USER_KEY);

// Clear everything
export const clearAuth = () => {
    removeToken();
    removeCachedUser();
};