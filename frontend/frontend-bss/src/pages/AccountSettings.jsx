import { useState, useEffect } from 'react';
import {
    ChevronRight, User, Mail, Shield, Loader2, AlertCircle, CheckCircle,
    Save, KeyRound, Eye, EyeOff
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import useAuth from '../hooks/useAuth.js';
import { getProfile, updateProfile, changePassword } from '../api/userApi';

function formatDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

const roleBadge = (role) => {
    switch (role) {
        case 'ADMIN':  return 'bg-violet-100 text-violet-700 border-violet-200';
        case 'EDITOR': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        default:       return 'bg-sky-100 text-sky-700 border-sky-200';
    }
};

/** Small inline notice used by both forms. */
function Notice({ type, children }) {
    if (!children) return null;
    const ok = type === 'success';
    return (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
            ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
               : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
            {ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {children}
        </div>
    );
}

export default function AccountSettings() {
    const { user, updateUser } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    // Profile form
    const [form, setForm] = useState({ displayName: '', email: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState({ type: null, text: '' });

    // Password form
    const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [showPw, setShowPw] = useState(false);
    const [savingPw, setSavingPw] = useState(false);
    const [pwMsg, setPwMsg] = useState({ type: null, text: '' });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const data = await getProfile();
                if (!cancelled) {
                    setProfile(data);
                    setForm({ displayName: data.displayName ?? '', email: data.email ?? '' });
                }
            } catch (err) {
                if (!cancelled) setLoadError(err.response?.data?.message || 'Failed to load your account.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        setProfileMsg({ type: null, text: '' });
        try {
            const updated = await updateProfile({
                displayName: form.displayName.trim(),
                email: form.email.trim(),
            });
            setProfile(updated);
            // Keep the sidebar / cached user in sync
            updateUser({ displayName: updated.displayName, email: updated.email });
            setProfileMsg({ type: 'success', text: 'Profile updated.' });
        } catch (err) {
            setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwMsg({ type: null, text: '' });

        if (pw.newPassword !== pw.confirmPassword) {
            setPwMsg({ type: 'error', text: 'New password and confirmation do not match.' });
            return;
        }

        setSavingPw(true);
        try {
            await changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
            setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPwMsg({ type: 'success', text: 'Password changed successfully.' });
        } catch (err) {
            setPwMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
        } finally {
            setSavingPw(false);
        }
    };

    const breadcrumb = (
        <>
            <span>Account</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">Settings</span>
        </>
    );

    const displayName = profile?.displayName || profile?.username || user?.displayName || user?.username || 'User';

    return (
        <EditorLayout activeItem="account" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

                <h1 className="text-2xl font-bold text-[#2C3325]">Account Settings</h1>

                {loadError && <Notice type="error">{loadError}</Notice>}

                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                    </div>
                ) : profile ? (
                    <>
                        {/* Overview card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                            <div className="w-16 h-16 rounded-full bg-[#C3CEAA]/40 border border-[#94A973]/40 flex items-center justify-center shrink-0">
                                <User className="w-8 h-8 text-[#4A533E]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-xl font-bold text-[#2C3325] truncate">{displayName}</h2>
                                <p className="text-sm text-[#6C755E] font-mono">@{profile.username}</p>
                            </div>
                            <div className="flex flex-col items-start sm:items-end gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border ${roleBadge(profile.role)}`}>
                                    <Shield className="w-3.5 h-3.5" /> {profile.role}
                                </span>
                                <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                                    profile.status
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                        : 'bg-rose-100 text-rose-700 border-rose-200'
                                }`}>
                                    {profile.status ? 'Active' : 'Disabled'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Profile form */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-[#2C3325] mb-1">Profile</h3>
                                <p className="text-sm text-[#6C755E] mb-5">Update your display name and email.</p>

                                <form onSubmit={handleSaveProfile} className="space-y-4">
                                    <Notice type={profileMsg.type}>{profileMsg.text}</Notice>

                                    <div>
                                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Username</label>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500">
                                            <User className="w-4 h-4 shrink-0" />
                                            <span className="font-mono">{profile.username}</span>
                                            <span className="ml-auto text-xs">cannot be changed</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Display Name</label>
                                        <input
                                            type="text"
                                            value={form.displayName}
                                            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                                            placeholder="Your name"
                                            maxLength={255}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Email</label>
                                        <div className="relative">
                                            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="email"
                                                value={form.email}
                                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                                placeholder="you@example.com"
                                                maxLength={255}
                                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                            />
                                        </div>
                                    </div>

                                    <div className="text-xs text-gray-400">
                                        Member since {formatDate(profile.createTime)} · Last updated {formatDate(profile.updateTime)}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="w-full px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                        {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {savingProfile ? 'Saving…' : 'Save Profile'}
                                    </button>
                                </form>
                            </div>

                            {/* Password form */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-lg font-bold text-[#2C3325]">Password</h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(s => !s)}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#94A973] hover:text-[#4A533E]"
                                    >
                                        {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        {showPw ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <p className="text-sm text-[#6C755E] mb-5">Choose a strong password you don&apos;t use elsewhere.</p>

                                <form onSubmit={handleChangePassword} className="space-y-4">
                                    <Notice type={pwMsg.type}>{pwMsg.text}</Notice>

                                    <div>
                                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Current Password</label>
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            required
                                            value={pw.currentPassword}
                                            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
                                            autoComplete="current-password"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-[#6C755E] mb-1">New Password</label>
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            value={pw.newPassword}
                                            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                                            autoComplete="new-password"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">At least 6 characters.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Confirm New Password</label>
                                        <input
                                            type={showPw ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            value={pw.confirmPassword}
                                            onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })}
                                            autoComplete="new-password"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={savingPw}
                                        className="w-full px-4 py-2 bg-[#2C3325] text-white font-medium rounded-lg hover:bg-[#4A533E] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                    >
                                        {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                        {savingPw ? 'Updating…' : 'Update Password'}
                                    </button>
                                </form>
                            </div>

                        </div>
                    </>
                ) : null}
            </div>
        </EditorLayout>
    );
}