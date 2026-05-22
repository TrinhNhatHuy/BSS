import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import AuthPage        from './pages/AuthPage';
import EditorDashboard from './pages/EditorDashboard';
import Unauthorized    from './pages/Unauthorized';

// Placeholders — replace with real pages when you build them
const AdminDashboard = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <p className="text-gray-400 text-lg">Admin Dashboard — coming soon</p>
    </div>
);
const UserHome = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <p className="text-gray-400 text-lg">User Home — coming soon</p>
    </div>
);

/**
 * App.jsx — routing root.
 *
 * Structure:
 *   /login              → AuthPage (public)
 *   /unauthorized       → Unauthorized (public)
 *   /editor/dashboard   → EditorDashboard (EDITOR role only)
 *   /admin/dashboard    → AdminDashboard  (ADMIN role only)
 *   /user/home          → UserHome        (USER role only)
 *   /                   → redirects to /login
 *   * (anything else)   → redirects to /login
 *
 * AuthProvider wraps everything so useAuth() works in every component.
 * BrowserRouter is here (not in main.jsx) to keep routing self-contained.
 */
function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>

                    {/* Public routes*/}
                    <Route path="/login"        element={<AuthPage />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />

                    {/* EDITOR-only routes */}
                    <Route element={<ProtectedRoute allowedRoles={['EDITOR']} />}>
                        <Route path="/editor/dashboard" element={<EditorDashboard />} />
                    </Route>

                    {/* ADMIN-only routes*/}
                    <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    </Route>

                    {/*USER-only routes*/}
                    <Route element={<ProtectedRoute allowedRoles={['USER']} />}>
                        <Route path="/user/home" element={<UserHome />} />
                    </Route>

                    {/* Catch-all → login */}
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />

                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;