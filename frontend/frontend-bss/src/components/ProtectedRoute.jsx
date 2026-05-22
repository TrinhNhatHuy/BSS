import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

/**
 * Route guard component.
 *
 * Usage in App.jsx:
 *
 *   // Any logged-in user:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/profile" element={<Profile />} />
 *   </Route>
 *
 *   // EDITOR only:
 *   <Route element={<ProtectedRoute allowedRoles={['EDITOR']} />}>
 *     <Route path="/editor/dashboard" element={<EditorDashboard />} />
 *   </Route>
 *
 * Decision tree:
 *   1. Still verifying token → show spinner (prevents flash redirect)
 *   2. Not authenticated    → redirect to /login
 *   3. Wrong role           → redirect to /unauthorized
 *   4. All checks pass      → render <Outlet /> (the child route)
 */
const ProtectedRoute = ({ allowedRoles }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-[#94A973] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-500 font-medium">Loading...</p>
                </div>
            </div>
        );
    }


    if (!user) {
        return <Navigate to="/login" replace />;
    }


    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }


    return <Outlet />;
};

export default ProtectedRoute;