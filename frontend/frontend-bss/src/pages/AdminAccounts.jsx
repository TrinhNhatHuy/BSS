import { useEffect, useState } from 'react';
import {
    ChevronRight, ChevronLeft, Users, Search, Plus, Trash2, Loader2,
    AlertCircle, CheckCircle, UserCog, Ban, CheckCircle2, ShieldCheck, X, Mail,
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import useAuth from '../hooks/useAuth.js';
import { listUsers, createUser, updateUserRole, updateUserStatus, deleteUser } from '../api/adminApi';

const roleBadge = (role) => {
    switch (role) {
        case 'ADMIN':  return 'bg-violet-100 text-violet-700 border-violet-200';
        case 'EDITOR': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        default:       return 'bg-sky-100 text-sky-700 border-sky-200';
    }
};

const formatDate = (dt) => (dt ? new Date(dt).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '—');

function Notice({ notice }) {
    if (!notice?.text) return null;
    const ok = notice.type === 'success';
    return (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
            ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
            {ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {notice.text}
        </div>
    );
}

export default function AdminAccounts() {
    const { user } = useAuth();

    const [filters, setFilters] = useState({ q: '', role: '', createdFrom: '', createdTo: '' });
    const [page, setPage] = useState(0);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState({ type: null, text: '' });
    const [refreshKey, setRefreshKey] = useState(0);
    const [busyId, setBusyId] = useState(null);

    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const updateFilter = (key, val) => {
        setFilters((f) => ({ ...f, [key]: val }));
        setPage(0);
    };

    // Debounced fetch on filter/page change.
    useEffect(() => {
        let cancelled = false;
        const t = setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const res = await listUsers(filters, page);
                if (!cancelled) setData(res);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load accounts.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [filters, page, refreshKey]);

    const refresh = () => setRefreshKey((k) => k + 1);

    const runAction = async (id, fn, successText) => {
        setBusyId(id);
        setNotice({ type: null, text: '' });
        try {
            await fn();
            setNotice({ type: 'success', text: successText });
            refresh();
        } catch (err) {
            setNotice({ type: 'error', text: err.response?.data?.message || 'Action failed.' });
        } finally {
            setBusyId(null);
        }
    };

    const onConfirmDelete = async () => {
        const u = deleteTarget;
        setDeleteTarget(null);
        await runAction(u.id, () => deleteUser(u.id), `Deleted “${u.username}”.`);
    };

    const breadcrumb = (
        <>
            <span>Admin</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">Accounts</span>
        </>
    );

    const rows = data?.content ?? [];
    const totalPages = data?.totalPages ?? 0;
    const totalElements = data?.totalElements ?? 0;

    return (
        <EditorLayout activeItem="accounts" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-5">

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-[#2C3325] flex items-center gap-2">
                            <Users className="w-6 h-6 text-[#94A973]" /> Accounts
                        </h1>
                        <p className="text-sm text-[#6C755E] mt-0.5">{totalElements} account{totalElements === 1 ? '' : 's'}</p>
                    </div>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Create account
                    </button>
                </div>

                <Notice notice={notice} />

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col lg:flex-row lg:items-end gap-3">
                    <div className="flex-1 min-w-0">
                        <label className="block text-xs font-bold text-[#6C755E] mb-1">Search</label>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={filters.q}
                                onChange={(e) => updateFilter('q', e.target.value)}
                                placeholder="Name, username or email…"
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#6C755E] mb-1">Role</label>
                        <select
                            value={filters.role}
                            onChange={(e) => updateFilter('role', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] bg-white"
                        >
                            <option value="">All roles</option>
                            <option value="USER">User</option>
                            <option value="EDITOR">Editor</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#6C755E] mb-1">Created from</label>
                        <input
                            type="date" value={filters.createdFrom}
                            onChange={(e) => updateFilter('createdFrom', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-[#6C755E] mb-1">Created to</label>
                        <input
                            type="date" value={filters.createdTo}
                            onChange={(e) => updateFilter('createdTo', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {error && (
                        <div className="m-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" /></div>
                        ) : rows.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 text-sm">No accounts match these filters.</div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[820px]">
                                <thead>
                                    <tr className="bg-[#F4F5F0] border-b border-gray-200 text-xs font-bold text-[#6C755E] uppercase tracking-wide">
                                        <th className="p-4">Account</th>
                                        <th className="p-4">Email</th>
                                        <th className="p-4 w-28">Role</th>
                                        <th className="p-4 w-28">Status</th>
                                        <th className="p-4 w-40">Created</th>
                                        <th className="p-4 w-64 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rows.map((u) => {
                                        const isAdmin = u.role === 'ADMIN';
                                        const isSelf = u.username === user?.username;
                                        const locked = isAdmin || isSelf; // can't manage admins or yourself
                                        const busy = busyId === u.id;
                                        return (
                                            <tr key={u.id} className="hover:bg-[#FAFAFA] transition-colors">
                                                <td className="p-4">
                                                    <p className="font-semibold text-[#2C3325]">{u.displayName || u.username}</p>
                                                    <p className="text-xs text-[#6C755E] font-mono">@{u.username}{isSelf && ' · you'}</p>
                                                </td>
                                                <td className="p-4 text-sm text-[#6C755E]">{u.email || '—'}</td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${roleBadge(u.role)}`}>
                                                        {isAdmin && <ShieldCheck className="w-3 h-3" />}{u.role}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full border ${
                                                        u.status ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                                                    }`}>
                                                        {u.status ? 'Active' : 'Disabled'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-[#6C755E] whitespace-nowrap">{formatDate(u.createTime)}</td>
                                                <td className="p-4 text-right">
                                                    {locked ? (
                                                        <span className="text-xs text-gray-400 italic">{isSelf ? 'your account' : 'protected'}</span>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-2 justify-end">
                                                            {busy && <Loader2 className="w-4 h-4 animate-spin text-[#94A973]" />}
                                                            {u.role === 'USER' ? (
                                                                <button
                                                                    onClick={() => runAction(u.id, () => updateUserRole(u.id, 'EDITOR'), `“${u.username}” is now an Editor.`)}
                                                                    disabled={busy}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                                                    title="Promote to Editor"
                                                                >
                                                                    <UserCog className="w-3.5 h-3.5" /> Make Editor
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => runAction(u.id, () => updateUserRole(u.id, 'USER'), `“${u.username}” is now a User.`)}
                                                                    disabled={busy}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-sky-200 text-sky-700 hover:bg-sky-50 disabled:opacity-60"
                                                                    title="Demote to User"
                                                                >
                                                                    <UserCog className="w-3.5 h-3.5" /> Make User
                                                                </button>
                                                            )}
                                                            {u.status ? (
                                                                <button
                                                                    onClick={() => runAction(u.id, () => updateUserStatus(u.id, false), `“${u.username}” disabled.`)}
                                                                    disabled={busy}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                                                                    title="Disable account"
                                                                >
                                                                    <Ban className="w-3.5 h-3.5" /> Stop
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => runAction(u.id, () => updateUserStatus(u.id, true), `“${u.username}” enabled.`)}
                                                                    disabled={busy}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                                                    title="Enable account"
                                                                >
                                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Enable
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setDeleteTarget(u)}
                                                                disabled={busy}
                                                                className="p-1.5 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                                                                title="Delete account"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-gray-100 text-sm">
                            <span className="text-[#6C755E]">Page {(data?.number ?? 0) + 1} of {totalPages}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={(data?.number ?? 0) <= 0}
                                    className="p-2 rounded-lg border border-gray-200 text-[#6C755E] hover:bg-gray-50 disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                    disabled={(data?.number ?? 0) >= totalPages - 1}
                                    className="p-2 rounded-lg border border-gray-200 text-[#6C755E] hover:bg-gray-50 disabled:opacity-40"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showCreate && (
                <CreateAccountModal
                    onClose={() => setShowCreate(false)}
                    onCreated={(username) => {
                        setShowCreate(false);
                        setNotice({ type: 'success', text: `Created “${username}”.` });
                        refresh();
                    }}
                />
            )}

            {deleteTarget && (
                <ConfirmDeleteModal
                    target={deleteTarget}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={onConfirmDelete}
                />
            )}
        </EditorLayout>
    );
}

// --- create modal -------------------------------------------------------------

function CreateAccountModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '', role: 'EDITOR' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const created = await createUser({
                username: form.username.trim(),
                email: form.email.trim(),
                password: form.password,
                displayName: form.displayName.trim(),
                role: form.role,
            });
            onCreated(created.username);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create account.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-[#2C3325] flex items-center gap-2">
                        <Plus className="w-5 h-5 text-[#94A973]" /> Create account
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={submit} className="p-5 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Username</label>
                        <input
                            required minLength={3} maxLength={50}
                            value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Email</label>
                        <div className="relative">
                            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email" required
                                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Display name <span className="font-normal text-gray-400">(optional)</span></label>
                        <input
                            value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Password</label>
                        <input
                            type="password" required minLength={8} autoComplete="new-password"
                            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                        />
                        <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#6C755E] mb-1">Role</label>
                        <select
                            value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] bg-white"
                        >
                            <option value="EDITOR">Editor</option>
                            <option value="USER">User</option>
                        </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] disabled:opacity-60 flex items-center justify-center gap-2">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// --- delete confirm -----------------------------------------------------------

function ConfirmDeleteModal({ target, onCancel, onConfirm }) {
    return (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="p-5">
                    <h3 className="text-lg font-bold text-[#2C3325] flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-rose-600" /> Delete account
                    </h3>
                    <p className="text-sm text-[#6C755E] mt-2">
                        Permanently delete <span className="font-semibold text-[#2C3325]">@{target.username}</span>?
                        This removes their bookmarks, reminders and preferences and can't be undone.
                    </p>
                </div>
                <div className="flex gap-3 p-5 pt-0">
                    <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700">Delete</button>
                </div>
            </div>
        </div>
    );
}