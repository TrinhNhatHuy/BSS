import React, { createContext, useState, useEffect, useCallback } from 'react';
import { loginApi, registerApi, getMeApi } from '../api/authApi';
import {
    getToken,
    setToken,
    getCachedUser,
    setCachedUser,
    clearAuth,
} from '../utils/tokenStorage';

/**
 * AuthContext — the single source of truth for authentication state.
 *
 * Exposes:
 *   user          → { id, username, displayName, email, role } | null
 *   loading       → true while verifying the stored token on app load
 *   login(creds)  → authenticates, stores token, returns user object
 *   register(data)→ registers new USER account, stores token, returns user
 *   logout()      → clears token + user, redirects to /login
 *   isAuthenticated → boolean shortcut
 */
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Seed from cache so the UI renders immediately on refresh (no flash)
    const [user, setUser]       = useState(getCachedUser);
    const [loading, setLoading] = useState(true);  // true until token is verified

    useEffect(() => {
        const verifyToken = async () => {
            const token = getToken();

            if (!token) {
                // No token at all — not logged in
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                // Ask the server if the token is still valid
                const freshUser = await getMeApi();
                setUser(freshUser);
                setCachedUser(freshUser);
            } catch {
                // Token expired or revoked — clean up silently
                clearAuth();
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        verifyToken();
    }, []);


    const login = useCallback(async (credentials) => {
        const data = await loginApi(credentials);
        // data = { token, username, displayName, role, expiresIn }

        setToken(data.token);

        // Build a user object consistent with what /me returns
        const userObj = {
            username:    data.username,
            displayName: data.displayName,
            role:        data.role,
        };

        setCachedUser(userObj);
        setUser(userObj);

        return userObj; // caller uses .role to decide where to navigate
    }, []);


    const register = useCallback(async (formData) => {
        const data = await registerApi(formData);

        setToken(data.token);

        const userObj = {
            username:    data.username,
            displayName: data.displayName,
            role:        data.role,
        };

        setCachedUser(userObj);
        setUser(userObj);

        return userObj;
    }, []);


    const logout = useCallback(() => {
        clearAuth();
        setUser(null);
        // Hard navigate so all component state is cleared
        window.location.href = '/login';
    }, []);


    const value = {
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};