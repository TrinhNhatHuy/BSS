import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    User, Mail, Shield, Loader2, AlertCircle, CheckCircle, Save, KeyRound,
    Eye, EyeOff, Bookmark, Bell, Trash2, Tv, Clock, Smartphone, Send, Check,
    ExternalLink, SlidersHorizontal, Pencil,
} from 'lucide-react';
import UserLayout from '../components/UserLayout.jsx';
import ReminderCard from '../components/ReminderCard.jsx';
import useAuth from '../hooks/useAuth.js';
import { CATEGORIES, categoryLabel, categoryBadge } from '../utils/categories.js';
import {
    isPushSupported, ensurePushSubscription, unsubscribeCurrentDevice,
    getCurrentPushEndpoint, notificationPermission,
} from '../utils/push.js';
import {
    getProfile, updateProfile, changePassword,
    getBookmarks, removeBookmark,
    getReminders, deleteReminder,
    getPreferences, setPreferences,
    getPushPublicKey, subscribePush, unsubscribePush,
    getTelegramStatus, disconnectTelegram,
} from '../api/userApi.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/** "HH:MM" from a YYYYMMDDHHMMSS string. */
const hhmm = (s) => (s && s.length >= 12 ? `${s.slice(8, 10)}:${s.slice(10, 12)}` : '--:--');

/** YYYYMMDDHHMMSS → friendly "Sat, 6 Jun · 23:00" (local wall-clock). */
function formatStart(s) {
    if (!s || s.length < 12) return '';
    const dt = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12));
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
}

const channelLabel = (c) => (c === 'BOTH' ? 'Device + Telegram' : c === 'TELEGRAM' ? 'Telegram' : 'This device');

/** Small inline notice (shared by all tabs). */
function Notice({ type, children }) {
    if (!children) return null;
    const ok = type === 'success';
    return (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
            ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
            {ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {children}
        </div>
    );
}

function Card({ title, subtitle, children, right }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="text-lg font-bold text-[#2C3325]">{title}</h3>
                {right}
            </div>
            {subtitle && <p className="text-sm text-[#6C755E] mb-5">{subtitle}</p>}
            {children}
        </div>
    );
}

function EmptyState({ icon, children }) {
    return (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center text-[#6C755E]">
            <div className="flex justify-center mb-3 text-gray-300">{icon}</div>
            {children}
        </div>
    );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

const roleBadge = (role) => {
    switch (role) {
        case 'ADMIN':  return 'bg-violet-100 text-violet-700 border-violet-200';
        case 'EDITOR': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        default:       return 'bg-sky-100 text-sky-700 border-sky-200';
    }
};

function ProfileTab() {
    const { user, updateUser } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [form, setForm] = useState({ displayName: '', email: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState({ type: null, text: '' });

    const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [showPw, setShowPw] = useState(false);
    const [savingPw, setSavingPw] = useState(false);
    const [pwMsg, setPwMsg] = useState({ type: null, text: '' });

    useEffect(() => {
        let cancelled = false;
        (async () => {
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
            const updated = await updateProfile({ displayName: form.displayName.trim(), email: form.email.trim() });
            setProfile(updated);
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

    if (loading) return <TabLoader />;
    if (loadError) return <Notice type="error">{loadError}</Notice>;
    if (!profile) return null;

    const displayName = profile.displayName || profile.username || user?.username || 'User';

    return (
        <div className="space-y-6">
            {/* Overview */}
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
                        profile.status ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                    }`}>
                        {profile.status ? 'Active' : 'Disabled'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profile form */}
                <Card title="Profile" subtitle="Update your display name and email.">
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
                </Card>

                {/* Password form */}
                <Card
                    title="Password"
                    subtitle="Choose a strong password you don't use elsewhere."
                    right={
                        <button
                            type="button"
                            onClick={() => setShowPw((s) => !s)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#94A973] hover:text-[#4A533E]"
                        >
                            {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {showPw ? 'Hide' : 'Show'}
                        </button>
                    }
                >
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
                </Card>
            </div>
        </div>
    );
}

// ── Bookmarks tab ──────────────────────────────────────────────────────────────

function BookmarksTab() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reminderProgram, setReminderProgram] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getBookmarks()
            .then((data) => { if (!cancelled) setItems(data || []); })
            .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Failed to load bookmarks.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const remove = async (programId) => {
        const prev = items;
        setItems((xs) => xs.filter((x) => x.programId !== programId));
        try { await removeBookmark(programId); } catch { setItems(prev); }
    };

    if (loading) return <TabLoader />;
    if (error) return <Notice type="error">{error}</Notice>;
    if (items.length === 0) {
        return <EmptyState icon={<Bookmark className="w-10 h-10" />}>
            No bookmarks yet. Tap the bookmark icon on any program to save it here.
        </EmptyState>;
    }

    return (
        <>
            <div className="space-y-3">
                {items.map((b) => (
                    <div key={b.programId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4">
                        <div className="shrink-0 w-14 text-right">
                            <p className="font-mono text-sm font-bold text-[#2C3325]">{hhmm(b.beginTime)}</p>
                            <p className="font-mono text-xs text-gray-400">{hhmm(b.endTime)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#2C3325] truncate">{b.name || 'Untitled program'}</p>
                            <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                {b.category && (
                                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${categoryBadge(b.category)}`}>
                                        {categoryLabel(b.category)}
                                    </span>
                                )}
                                <span className="text-xs text-[#6C755E]">{b.channelName || b.channelId}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => setReminderProgram({ id: b.programId, name: b.name, beginTime: b.beginTime, channelName: b.channelName })}
                                className="p-1.5 rounded-md text-gray-400 hover:text-[#4A533E] hover:bg-gray-100 transition-colors"
                                title="Set reminder"
                            >
                                <Bell className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => navigate(`/user/channels/${b.channelId}`)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-[#4A533E] hover:bg-gray-100 transition-colors"
                                title="Open in channel"
                            >
                                <Tv className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => remove(b.programId)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Remove bookmark"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {reminderProgram && (
                <ReminderCard program={reminderProgram} onClose={() => setReminderProgram(null)} onSaved={() => {}} />
            )}
        </>
    );
}

// ── Reminders tab ───────────────────────────────────────────────────────────────

function RemindersTab() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(null);

    // Refetch the list (used after an edit/delete via the modal).
    const reload = async () => {
        try {
            setItems(await getReminders() || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load reminders.');
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await getReminders();
                if (!cancelled) setItems(data || []);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load reminders.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const remove = async (programId) => {
        const prev = items;
        setItems((xs) => xs.filter((x) => x.programId !== programId));
        try { await deleteReminder(programId); } catch { setItems(prev); }
    };

    if (loading) return <TabLoader />;
    if (error) return <Notice type="error">{error}</Notice>;
    if (items.length === 0) {
        return <EmptyState icon={<Bell className="w-10 h-10" />}>
            No scheduled reminders. Tap the bell on a program to be notified before it starts.
        </EmptyState>;
    }

    return (
        <>
            <div className="space-y-3">
                {items.map((r) => (
                    <div key={r.programId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 items-center">
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#2C3325] truncate">{r.programName || 'Untitled program'}</p>
                            <p className="text-sm text-[#6C755E] mt-0.5">
                                Starts {formatStart(r.beginTime)}{r.channelName ? ` · ${r.channelName}` : ''}
                            </p>
                            <div className="flex items-center flex-wrap gap-2 mt-2 text-xs">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F5F0] text-[#4A533E] font-semibold">
                                    <Clock className="w-3 h-3" />
                                    {r.minutesBefore === 0 ? 'At start' : `${r.minutesBefore} min before`}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-[#F4F5F0] text-[#4A533E] font-semibold">
                                    via {channelLabel(r.channel)}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md font-semibold ${
                                    r.sent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {r.sent ? 'Sent' : 'Pending'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => setEditing({ id: r.programId, name: r.programName, beginTime: r.beginTime, channelName: r.channelName })}
                                className="p-1.5 rounded-md text-gray-400 hover:text-[#4A533E] hover:bg-gray-100 transition-colors"
                                title="Edit reminder"
                            >
                                <Pencil className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => remove(r.programId)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete reminder"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {editing && (
                <ReminderCard
                    program={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => { reload(); }}
                />
            )}
        </>
    );
}

// ── Notifications tab ────────────────────────────────────────────────────────────

function NotificationsTab() {
    const [loading, setLoading] = useState(true);
    const [push, setPush] = useState({ enabled: false, publicKey: '' });
    const [subscribed, setSubscribed] = useState(false);
    const [telegram, setTelegram] = useState({ available: false, connected: false, deepLink: null, botUsername: null });
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ type: null, text: '' });

    const supported = isPushSupported();

    const load = async () => {
        try {
            const [pk, tg, endpoint] = await Promise.all([
                getPushPublicKey().catch(() => ({ enabled: false, publicKey: '' })),
                getTelegramStatus().catch(() => ({ available: false, connected: false })),
                getCurrentPushEndpoint().catch(() => null),
            ]);
            setPush(pk);
            setTelegram(tg);
            setSubscribed(!!endpoint);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const enablePush = async () => {
        setMsg({ type: null, text: '' });
        setBusy(true);
        try {
            if (!supported) throw new Error('This browser does not support notifications.');
            if (!push.enabled) throw new Error('Push is not configured on the server.');
            const sub = await ensurePushSubscription(push.publicKey);
            if (!sub) throw new Error('Allow notifications in your browser to enable device reminders.');
            await subscribePush(sub);
            setSubscribed(true);
            setMsg({ type: 'success', text: 'This device will now receive reminder notifications.' });
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.message || err.message || 'Could not enable notifications.' });
        } finally {
            setBusy(false);
        }
    };

    const disablePush = async () => {
        setMsg({ type: null, text: '' });
        setBusy(true);
        try {
            const endpoint = await unsubscribeCurrentDevice();
            if (endpoint) await unsubscribePush(endpoint);
            setSubscribed(false);
            setMsg({ type: 'success', text: 'Device notifications turned off.' });
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.message || 'Could not turn off notifications.' });
        } finally {
            setBusy(false);
        }
    };

    const recheckTelegram = async () => {
        try { setTelegram(await getTelegramStatus()); } catch { /* ignore */ }
    };

    const disconnect = async () => {
        setBusy(true);
        try { await disconnectTelegram(); await recheckTelegram(); }
        catch (err) { setMsg({ type: 'error', text: err.response?.data?.message || 'Could not disconnect Telegram.' }); }
        finally { setBusy(false); }
    };

    if (loading) return <TabLoader />;

    const permission = notificationPermission();
    const pushSubtitle = !supported ? 'Not supported in this browser'
        : !push.enabled ? 'Push is not configured on the server'
            : permission === 'denied' ? 'Blocked — allow notifications in your browser settings'
                : subscribed ? 'Enabled on this device' : 'Off on this device';

    return (
        <div className="space-y-6 max-w-2xl">
            <Notice type={msg.type}>{msg.text}</Notice>

            {/* Web Push */}
            <Card title="Browser / device notifications" subtitle="Get reminders on this device, even when BSS isn't open.">
                <div className="flex items-center gap-4">
                    <span className="text-[#4A533E]"><Smartphone className="w-6 h-6" /></span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#2C3325]">This device</p>
                        <p className="text-xs text-[#6C755E]">{pushSubtitle}</p>
                    </div>
                    {subscribed ? (
                        <button
                            onClick={disablePush}
                            disabled={busy}
                            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Turn off
                        </button>
                    ) : (
                        <button
                            onClick={enablePush}
                            disabled={busy || !supported || !push.enabled || permission === 'denied'}
                            className="px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Enable
                        </button>
                    )}
                </div>
            </Card>

            {/* Telegram */}
            <Card title="Telegram" subtitle="Receive reminders as Telegram messages.">
                {!telegram.available ? (
                    <p className="text-sm text-[#6C755E]">Telegram delivery is not configured on the server.</p>
                ) : (
                    <div className="flex items-center gap-4">
                        <span className="text-[#4A533E]"><Send className="w-6 h-6" /></span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#2C3325] flex items-center gap-1.5">
                                {telegram.connected && <Check className="w-4 h-4 text-[#94A973]" />}
                                {telegram.connected ? 'Connected' : 'Not connected'}
                            </p>
                            <p className="text-xs text-[#6C755E]">
                                {telegram.connected ? 'Reminders set to Telegram will be delivered here.' : 'Open the bot, press Start, then re-check.'}
                            </p>
                        </div>
                        {telegram.connected ? (
                            <button
                                onClick={disconnect}
                                disabled={busy}
                                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                            >
                                Disconnect
                            </button>
                        ) : (
                            <div className="flex items-center gap-3 shrink-0">
                                {telegram.deepLink && (
                                    <a
                                        href={telegram.deepLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" /> Connect
                                    </a>
                                )}
                                <button onClick={recheckTelegram} className="text-sm text-[#6C755E] underline">Re-check</button>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ── Preferences tab ───────────────────────────────────────────────────────────────

function PreferencesTab() {
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: null, text: '' });

    useEffect(() => {
        let cancelled = false;
        getPreferences()
            .then((data) => { if (!cancelled) setSelected(data.categories || []); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const toggle = (key) => {
        setMsg({ type: null, text: '' });
        setSelected((prev) => {
            if (prev.includes(key)) return prev.filter((k) => k !== key);
            if (prev.length >= 2) return prev;
            return [...prev, key];
        });
    };

    const save = async () => {
        if (selected.length < 1) { setMsg({ type: 'error', text: 'Pick at least one category.' }); return; }
        setSaving(true);
        setMsg({ type: null, text: '' });
        try {
            await setPreferences(selected);
            setMsg({ type: 'success', text: 'Preferences saved. Your home recommendations will update.' });
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.message || 'Could not save your preferences.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <TabLoader />;

    return (
        <Card title="Favourite categories" subtitle="Pick 1 or 2. We put today's matching programs front and center on your home page.">
            <div className="space-y-5">
                <Notice type={msg.type}>{msg.text}</Notice>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {CATEGORIES.map((c) => {
                        const isSelected = selected.includes(c.key);
                        const disabled = !isSelected && selected.length >= 2;
                        return (
                            <button
                                key={c.key}
                                onClick={() => toggle(c.key)}
                                disabled={disabled}
                                className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all ${
                                    isSelected ? 'border-[#94A973] bg-[#C3CEAA]/30 shadow-sm'
                                        : disabled ? 'border-gray-100 bg-white opacity-50 cursor-not-allowed'
                                            : 'border-gray-200 bg-white hover:border-[#94A973] hover:shadow-sm'
                                }`}
                            >
                                {isSelected && (
                                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#94A973] text-white flex items-center justify-center">
                                        <Check className="w-4 h-4" />
                                    </span>
                                )}
                                <span className="text-4xl">{c.emoji}</span>
                                <span className="text-sm font-semibold text-[#2C3325]">{c.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={save}
                        disabled={saving || selected.length < 1}
                        className="px-8 py-2.5 bg-[#94A973] hover:bg-[#8A9F6B] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? 'Saving…' : 'Save preferences'}
                    </button>
                    <span className="text-xs text-[#6C755E]">{selected.length}/2 selected</span>
                </div>
            </div>
        </Card>
    );
}

// ── shell ───────────────────────────────────────────────────────────────────────

function TabLoader() {
    return (
        <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
        </div>
    );
}

const TABS = [
    { key: 'profile',       label: 'Profile',       icon: User },
    { key: 'bookmarks',     label: 'Bookmarks',     icon: Bookmark },
    { key: 'reminders',     label: 'Reminders',     icon: Bell },
    { key: 'notifications', label: 'Notifications', icon: Smartphone },
    { key: 'preferences',   label: 'Preferences',   icon: SlidersHorizontal },
];

/**
 * USER "My Account" — one tabbed page to manage profile/password, bookmarked
 * programs, scheduled reminders, notification delivery, and favourite categories.
 * Reached from the avatar dropdown; supports ?tab=<key> deep-links.
 */
export default function UserAccount() {
    const [searchParams, setSearchParams] = useSearchParams();
    const param = searchParams.get('tab');
    const active = useMemo(() => (TABS.some((t) => t.key === param) ? param : 'profile'), [param]);

    const setTab = (key) => setSearchParams(key === 'profile' ? {} : { tab: key }, { replace: true });

    return (
        <UserLayout>
            <div className="max-w-5xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold text-[#2C3325]">My Account</h1>

                {/* Tab bar */}
                <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const on = active === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                                    on ? 'border-[#94A973] text-[#2C3325]' : 'border-transparent text-[#6C755E] hover:text-[#4A533E]'
                                }`}
                            >
                                <Icon className="w-4 h-4" /> {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab content — keyed so each remounts (and refetches) on switch */}
                <div key={active}>
                    {active === 'profile' && <ProfileTab />}
                    {active === 'bookmarks' && <BookmarksTab />}
                    {active === 'reminders' && <RemindersTab />}
                    {active === 'notifications' && <NotificationsTab />}
                    {active === 'preferences' && <PreferencesTab />}
                </div>
            </div>
        </UserLayout>
    );
}