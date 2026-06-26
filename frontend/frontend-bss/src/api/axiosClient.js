import axios from 'axios';
import { getToken, clearAuth } from '../utils/tokenStorage';

/**
 * Single axios instance used by every API call in the app.
 *
 * Two interceptors:
 *  1. Request  → attaches "Authorization: Bearer <token>" if a token exists
 *  2. Response → on 401, clears auth state and redirects to /login
 *                (handles expired tokens without any extra logic in components)
 */
const axiosClient = axios.create({
    // Same-origin in production (browser calls /api/... on the site's own domain,
    // which Caddy routes to the backend), localhost in `npm run dev`. An explicit
    // VITE_API_BASE_URL still overrides both if ever needed.
    baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:8080'),
    headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid — clean up and force re-login
            clearAuth();
            // Only redirect if not already on the login page (avoid redirect loop)
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default axiosClient;