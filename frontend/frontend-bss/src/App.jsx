import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import AuthPage        from './pages/AuthPage';
import EditorDashboard from './pages/EditorDashboard.jsx';
import ManageChannels  from './pages/ChannelIndex.jsx';
import ViewChannel     from './pages/ViewChannel.jsx';
import ProgramIndex    from './pages/ProgramIndex.jsx';
import ProgramDetails  from './pages/ProgramDetails.jsx';
import ManageSources   from './pages/ManageSource.jsx';
import RescheduleLogs  from './pages/RescheduleLogs.jsx';
import DraftsByAI      from './pages/DraftsByAI.jsx';
import ChannelRescheduleLogs from './pages/ChannelRescheduleLogs.jsx';
import RescheduleLogDetail   from './pages/RescheduleLogDetail.jsx';
import ExportXLSX      from './pages/ExportXLSX.jsx';
import AccountSettings from './pages/AccountSettings.jsx';
import UserHome        from './pages/UserHome.jsx';
import UserChannels    from './pages/UserChannels.jsx';
import UserViewChannel from './pages/UserViewChannel.jsx';
import UserOnboarding  from './pages/UserOnboarding.jsx';
import UserAccount     from './pages/UserAccount.jsx';
import AdminAccounts   from './pages/AdminAccounts.jsx';
import Unauthorized    from './pages/Unauthorized';

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

                    {/* EDITOR routes — ADMIN shares the full editor app */}
                    <Route element={<ProtectedRoute allowedRoles={['EDITOR', 'ADMIN']} />}>
                        <Route path="/editor/dashboard"      element={<EditorDashboard />} />
                        <Route path="/editor/channels"       element={<ManageChannels />} />
                        <Route path="/editor/channels/:id"   element={<ViewChannel />} />
                        <Route path="/editor/channels/:id/reschedule-logs"         element={<ChannelRescheduleLogs />} />
                        <Route path="/editor/channels/:id/reschedule-logs/:logId"  element={<RescheduleLogDetail />} />
                        <Route path="/editor/programs"       element={<ProgramIndex />} />
                        <Route path="/editor/programs/:id"   element={<ProgramDetails />} />
                        <Route path="/editor/drafts"         element={<DraftsByAI />} />
                        <Route path="/editor/sources"        element={<ManageSources />} />
                        <Route path="/editor/reschedule-logs" element={<RescheduleLogs />} />
                        <Route path="/editor/export"          element={<ExportXLSX />} />
                        <Route path="/editor/account"         element={<AccountSettings />} />
                    </Route>

                    {/* ADMIN-only routes (the account-management tab) */}
                    <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                        <Route path="/admin/accounts" element={<AdminAccounts />} />
                        <Route path="/admin/dashboard" element={<Navigate to="/editor/dashboard" replace />} />
                    </Route>

                    {/*USER-only routes*/}
                    <Route element={<ProtectedRoute allowedRoles={['USER']} />}>
                        <Route path="/user/home"          element={<UserHome />} />
                        <Route path="/user/channels"      element={<UserChannels />} />
                        <Route path="/user/channels/:id"  element={<UserViewChannel />} />
                        <Route path="/user/account"       element={<UserAccount />} />
                        <Route path="/user/onboarding"    element={<UserOnboarding />} />
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