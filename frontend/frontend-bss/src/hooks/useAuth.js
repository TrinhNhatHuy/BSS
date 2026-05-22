import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * Shortcut hook so components don't need to import both
 * useContext and AuthContext every time.
 *
 * Usage:
 *   const { user, login, logout, loading } = useAuth();
 *
 * Throws if used outside <AuthProvider> — catches missing provider early.
 */
const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used inside <AuthProvider>');
    }
    return context;
};

export default useAuth;