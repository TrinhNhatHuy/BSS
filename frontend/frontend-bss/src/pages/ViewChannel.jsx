import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronRight, ChevronLeft, Calendar, RefreshCw, ArrowLeft,
    MonitorPlay, AlertCircle, Loader2, Sparkles, Eye, History, FileSpreadsheet,
    Edit2, Trash2, Save, X
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getChannelById, getChannelGroups, updateChannel, renameChannel, deleteChannel } from '../api/channelApi';
import { getProgramsForChannel } from '../api/programApi';
import { getRescheduleLogs } from '../api/rescheduleLogApi';

/** YYYYMMDDHHMMSS → "YYYY-MM-DD HH:MM:SS" ('' if missing/invalid) */
function formatFull(s) {
    if (!s || s.length < 14) return '';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/** ISO LocalDateTime ("2026-05-24T14:30:22") → "2026-05-24 14:30:22" ('' if null) */
function formatDateTime(iso) {
    if (!iso) return '';
    return iso.replace('T', ' ').slice(0, 19);
}

/** Date → "YYYY-MM-DD" (local) for both the API and <input type="date"> */
function toIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function categoryColor(category) {
    switch (category) {
        case 'News':     return 'bg-sky-50 text-sky-700 border-sky-200';
        case 'Sports':   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Music':    return 'bg-violet-50 text-violet-700 border-violet-200';
        case 'Kids':     return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'SeriesVN':
        case 'SeriesFR': return 'bg-rose-50 text-rose-700 border-rose-200';
        default:         return 'bg-gray-50 text-gray-600 border-gray-200';
    }
}

/** ISO LocalDateTime ("2026-05-24T14:30:22") → "2026-05-24 14:30:22" ('—' if null) */
function formatLogTime(iso) {
    if (!iso) return '—';
    return iso.replace('T', ' ').slice(0, 19);
}

function logStatusStyle(status) {
    switch (status) {
        case 'ADDED':    return 'bg-sky-100 text-sky-700 border-sky-200';
        case 'MODIFIED': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'DELETED':  return 'bg-rose-100 text-rose-700 border-rose-200';
        default:         return 'bg-gray-100 text-gray-700 border-gray-200';
    }
}

/** One-line summary of which fields a reschedule log changed. */
function logChangeSummary(log) {
    if (log.status === 'ADDED')   return 'New program entry added';
    if (log.status === 'DELETED') return 'Program removed from schedule';
    const fields = [
        { label: 'Start Time', oldVal: log.originalBeginTime, newVal: log.beginTime },
        { label: 'End Time',   oldVal: log.originalEndTime,   newVal: log.endTime },
        { label: 'Name',       oldVal: log.originalName,      newVal: log.name },
        { label: 'Content',    oldVal: log.originalContent,   newVal: log.content },
    ];
    const changed = fields.filter(f => (f.oldVal ?? '') !== (f.newVal ?? '')).map(f => f.label);
    return changed.length ? changed.join(', ') + ' updated' : '—';
}

/** A single label/value row inside the Channel Details card. */
function DetailItem({ label, children }) {
    return (
        <div>
            <p className="text-xs text-[#6C755E] font-medium uppercase tracking-wide mb-1">{label}</p>
            <div className="text-sm font-semibold text-[#2C3325]">{children}</div>
        </div>
    );
}

export default function ViewChannel() {
    const { id } = useParams();
    const navigate = useNavigate();

    // Combined state per resource — one setter call per phase to satisfy
    // react-hooks/set-state-in-effect (no cascading mid-effect renders).
    const [channelState, setChannelState] = useState({ data: null, loading: true, error: null });
    const [programsState, setProgramsState] = useState({ data: [], loading: false, error: null });
    const channel = channelState.data;
    const channelLoading = channelState.loading;
    const channelError = channelState.error;
    const programs = programsState.data;
    const programsLoading = programsState.loading;
    const programsError = programsState.error;

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshKey, setRefreshKey] = useState(0);
    const [aiNotice, setAiNotice] = useState(false);

    // Channel groups for the Modify picker
    const [channelGroups, setChannelGroups] = useState([]);

    // Modify modal
    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({ id: '', name: '', channelGroupId: '' });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState(null);

    // Reschedule logs modal
    const [logsOpen, setLogsOpen] = useState(false);
    const [logsState, setLogsState] = useState({ data: [], loading: false, error: null });

    // Delete confirmation modal
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    // Load channel detail
    useEffect(() => {
        let cancelled = false;
        getChannelById(id)
            .then(data => { if (!cancelled) setChannelState({ data, loading: false, error: null }); })
            .catch(err => {
                if (!cancelled) setChannelState({
                    data: null, loading: false,
                    error: err.response?.data?.message || 'Failed to load channel.',
                });
            });
        return () => { cancelled = true; };
    }, [id, refreshKey]);

    // Load channel groups once for the Modify picker
    useEffect(() => {
        getChannelGroups().then(setChannelGroups).catch(() => setChannelGroups([]));
    }, []);

    // Load programs for the selected date
    useEffect(() => {
        let cancelled = false;
        getProgramsForChannel(id, toIsoDate(selectedDate))
            .then(data => { if (!cancelled) setProgramsState({ data, loading: false, error: null }); })
            .catch(err => {
                if (!cancelled) setProgramsState({
                    data: [], loading: false,
                    error: err.response?.data?.message || 'Failed to load programs.',
                });
            });
        return () => { cancelled = true; };
    }, [id, selectedDate, refreshKey]);

    const changeDate = (deltaDays) => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + deltaDays);
        setSelectedDate(next);
    };

    const onDateInputChange = (e) => {
        if (!e.target.value) return;
        // Parse as local date (avoid UTC shift from new Date('YYYY-MM-DD'))
        const [y, m, d] = e.target.value.split('-').map(Number);
        setSelectedDate(new Date(y, m - 1, d));
    };

    const isToday = toIsoDate(selectedDate) === toIsoDate(new Date());

    // --- Modify channel (id / name / group) ---
    const openEdit = () => {
        if (!channel) return;
        setEditError(null);
        setEditForm({
            id: channel.id,
            name: channel.name,
            channelGroupId: channel.channelGroupId != null ? String(channel.channelGroupId) : '',
        });
        setEditOpen(true);
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        setEditSaving(true);
        setEditError(null);

        const newId = editForm.id.trim();
        const groupId = editForm.channelGroupId === '' ? null : Number(editForm.channelGroupId);

        try {
            // PUT replaces the whole channel, so preserve sources/exportIds and
            // only change name + group here.
            await updateChannel(channel.id, {
                name: editForm.name.trim(),
                channelGroupId: groupId,
                sources: channel.sources?.map(s => s.name) ?? [],
                exportIds: channel.exportIds?.map(ex => ({ type: ex.type, externalId: ex.externalId })) ?? [],
            });

            if (newId !== channel.id) {
                // Rename the primary key; child rows cascade server-side.
                await renameChannel(channel.id, newId);
                setEditOpen(false);
                // The URL still holds the old id — move to the new one so the page reloads.
                navigate(`/editor/channels/${encodeURIComponent(newId)}`, { replace: true });
            } else {
                setEditOpen(false);
                setRefreshKey(k => k + 1);
            }
        } catch (err) {
            setEditError(err.response?.data?.message || 'Failed to save changes.');
        } finally {
            setEditSaving(false);
        }
    };

    // --- View reschedule logs for this channel ---
    const openLogs = () => {
        setLogsOpen(true);
        setLogsState({ data: [], loading: true, error: null });
        getRescheduleLogs({ channelId: id }, 0, 200)
            .then(res => setLogsState({ data: res.content ?? [], loading: false, error: null }))
            .catch(err => setLogsState({
                data: [], loading: false,
                error: err.response?.data?.message || 'Failed to load reschedule logs.',
            }));
    };

    // --- Delete channel ---
    const handleDelete = async () => {
        setDeleting(true);
        setDeleteError(null);
        try {
            await deleteChannel(channel.id);
            navigate('/editor/channels');
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete channel.');
            setDeleting(false);
        }
    };

    const breadcrumb = (
        <>
            <span>Manage</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span onClick={() => navigate('/editor/channels')} className="cursor-pointer hover:text-[#4A533E]">Channels</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">{channel?.name || id}</span>
        </>
    );

    return (
        <EditorLayout activeItem="channels" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">

                {/* Top: back + title */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/editor/channels')}
                        className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-[#6C755E] transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-2xl font-bold text-[#2C3325] flex items-center gap-2">
                        <MonitorPlay className="w-6 h-6 text-[#94A973]" />
                        {channel?.name || id} <span className="text-gray-300 font-normal">Schedule</span>
                    </h1>
                </div>

                {/* Channel error */}
                {channelError && (
                    <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{channelError}</span>
                    </div>
                )}

                {/* Channel-level actions: modify, view logs, delete */}
                {channel && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={openEdit}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-white border border-[#94A973] text-[#4A533E] hover:bg-[#F4F5F0] transition-colors shadow-sm"
                            title="Edit channel ID, name and group"
                        >
                            <Edit2 className="w-4 h-4" /> Modify
                        </button>
                        <button
                            onClick={openLogs}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-white border border-gray-200 text-[#4A533E] hover:bg-gray-50 transition-colors shadow-sm"
                            title="View this channel's reschedule logs"
                        >
                            <History className="w-4 h-4" /> View Reschedule Logs
                        </button>
                        <button
                            onClick={() => { setDeleteError(null); setDeleteOpen(true); }}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shadow-sm"
                            title="Delete this channel"
                        >
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    </div>
                )}

                {/* ============================================================ */}
                {/* CHANNEL DETAILS — full width, on top                         */}
                {/* ============================================================ */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
                    <h3 className="font-bold text-[#2C3325] text-lg mb-5">Channel Details</h3>

                    {channelLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-[#94A973]" />
                    ) : channel ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
                            <DetailItem label="ID">
                                <span className="font-mono">{channel.id}</span>
                            </DetailItem>

                            <DetailItem label="Channel Name">{channel.name}</DetailItem>

                            <DetailItem label="Channel Group">
                                {channel.channelGroupName}
                            </DetailItem>

                            <DetailItem label="Schedule Changes (today)">
                                <span className="inline-flex items-center gap-1.5">
                                    <History className="w-4 h-4 text-[#94A973]" />
                                    {channel.rescheduleLogCount ?? 0}
                                    <span className="text-xs font-normal text-[#6C755E]">reschedule logs</span>
                                </span>
                            </DetailItem>

                            <DetailItem label="Create Time">{formatDateTime(channel.createTime)}</DetailItem>

                            <DetailItem label="Last Modified Time">{formatDateTime(channel.updateTime)}</DetailItem>

                            <div className="col-span-2 lg:col-span-2">
                                <p className="text-xs text-[#6C755E] font-medium uppercase tracking-wide mb-1">Sources</p>
                                {channel.sources?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {channel.sources.map(s => (
                                            <span key={s.name} className="inline-flex items-center px-2.5 py-1 bg-[#F4F5F0] border border-[#E4E3CE] rounded-md text-xs font-semibold text-[#4A533E]">
                                                {s.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* ============================================================ */}
                {/* BROADCAST TIMELINE — below                                   */}
                {/* ============================================================ */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[400px]">

                    {/* Card header: title + Clean with AI + date picker + refresh */}
                    <div className="p-4 border-b border-gray-100 bg-[#FAFAFA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <h3 className="font-bold text-[#2C3325]">
                            Broadcast Timeline
                            <span className="text-[#6C755E] font-normal text-sm ml-2">
                                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                        </h3>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Clean with AI */}
                            <button
                                onClick={() => setAiNotice(true)}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-[#94A973] text-white hover:bg-[#7e9460] transition-colors shadow-sm"
                                title="Run AI cleaning on this channel's schedule"
                            >
                                <Sparkles className="w-4 h-4" /> Clean with AI
                            </button>

                            {/* Export this channel's schedule for the viewed date */}
                            <button
                                onClick={() => navigate(`/editor/export?channelId=${encodeURIComponent(id)}&date=${toIsoDate(selectedDate)}`)}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-white border border-[#94A973] text-[#4A533E] hover:bg-[#F4F5F0] transition-colors"
                                title="Export this channel's schedule for this date to Excel"
                            >
                                <FileSpreadsheet className="w-4 h-4" /> Export to XLSX
                            </button>

                            {/* Date picker */}
                            {!isToday && (
                                <button
                                    onClick={() => setSelectedDate(new Date())}
                                    className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-[#6C755E] font-medium transition-colors"
                                >
                                    Today
                                </button>
                            )}
                            <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1">
                                <button onClick={() => changeDate(-1)} className="p-1.5 text-[#6C755E] hover:bg-gray-50 rounded-md transition-colors" title="Previous day">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <label className="flex items-center gap-2 px-2 cursor-pointer">
                                    <Calendar className="w-4 h-4 text-[#94A973]" />
                                    <input
                                        type="date"
                                        value={toIsoDate(selectedDate)}
                                        onChange={onDateInputChange}
                                        className="bg-transparent font-semibold text-[#4A533E] text-sm outline-none cursor-pointer"
                                    />
                                </label>
                                <button onClick={() => changeDate(1)} className="p-1.5 text-[#6C755E] hover:bg-gray-50 rounded-md transition-colors" title="Next day">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Refresh */}
                            <button
                                onClick={() => setRefreshKey(k => k + 1)}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-[#94A973] text-[#6C755E] hover:text-[#4A533E] hover:bg-[#F4F5F0] font-medium rounded-lg transition-colors"
                                title="Reload latest schedule data"
                            >
                                <RefreshCw className={`w-4 h-4 ${programsLoading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        </div>
                    </div>

                    {/* Clean-with-AI notice (no AI backend wired yet) */}
                    {aiNotice && (
                        <div className="m-4 flex items-start gap-2 p-3 bg-[#F4F5F0] border border-[#E4E3CE] rounded-lg text-[#4A533E] text-sm">
                            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#94A973]" />
                            <span className="flex-1">AI cleaning isn’t connected to a backend yet — this button is a placeholder for the upcoming schedule-cleaning pipeline.</span>
                            <button onClick={() => setAiNotice(false)} className="text-[#6C755E] hover:text-[#2C3325] font-bold">×</button>
                        </div>
                    )}

                    {/* Table */}
                    <div className="flex-1 overflow-x-auto">
                        {programsError && (
                            <div className="m-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {programsError}
                            </div>
                        )}

                        {programsLoading ? (
                            <div className="p-12 text-center">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                            </div>
                        ) : programs.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 text-sm">
                                No programs scheduled for this date.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr className="bg-[#F4F5F0] border-b border-gray-200 text-xs font-bold text-[#6C755E] uppercase tracking-wide">
                                        <th className="p-4">Program Name</th>
                                        <th className="p-4">Content</th>
                                        <th className="p-4 w-32">Category</th>
                                        <th className="p-4 w-44">Start Time</th>
                                        <th className="p-4 w-44">End Time</th>
                                        <th className="p-4 w-24 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {programs.map(p => (
                                        <tr key={p.id} className="hover:bg-[#FAFAFA] transition-colors">
                                            <td className="p-4 align-top">
                                                <p className="font-semibold text-[#2C3325]">{p.name}</p>
                                            </td>
                                            <td className="p-4 align-top">
                                                {p.content && (
                                                    <p className="text-sm text-[#6C755E] line-clamp-2 max-w-md">{p.content}</p>
                                                )}
                                            </td>
                                            <td className="p-4 align-top">
                                                {p.category && (
                                                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-md border ${categoryColor(p.category)}`}>
                                                        {p.category}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 align-top font-bold text-[#4A533E] whitespace-nowrap">
                                                {formatFull(p.beginTime)}
                                            </td>
                                            <td className="p-4 align-top text-[#6C755E] whitespace-nowrap">
                                                {formatFull(p.endTime)}
                                            </td>
                                            <td className="p-4 align-top text-right">
                                                <button
                                                    onClick={() => navigate(`/editor/programs/${p.id}`)}
                                                    className="inline-flex items-center gap-1 text-[#94A973] hover:text-[#4A533E] font-medium text-sm transition-colors"
                                                    title="View program details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    <span className="hidden sm:inline">View</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* MODIFY CHANNEL MODAL                                         */}
            {/* ============================================================ */}
            {editOpen && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <h3 className="text-xl font-bold text-[#2C3325]">Modify Channel</h3>
                            <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleEditSave} className="p-5 space-y-4 overflow-y-auto">
                            {editError && (
                                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {editError}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">
                                    Channel ID <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.id}
                                    onChange={(e) => setEditForm({ ...editForm, id: e.target.value.toUpperCase() })}
                                    pattern="^[A-Z0-9_]+$"
                                    title="Uppercase letters, digits, and underscores only"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] font-mono"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    Changing the ID re-links every program, reschedule log and export tied to this channel.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">
                                    Channel Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={50}
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Channel Group</label>
                                <select
                                    value={editForm.channelGroupId}
                                    onChange={(e) => setEditForm({ ...editForm, channelGroupId: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] bg-white"
                                >
                                    <option value="">No group</option>
                                    {channelGroups.map(g => (
                                        <option key={g.id} value={String(g.id)}>{g.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setEditOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editSaving}
                                    className="flex-1 px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {editSaving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* RESCHEDULE LOGS MODAL                                        */}
            {/* ============================================================ */}
            {logsOpen && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#FAFAFA] shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-lg font-bold text-[#2C3325] flex items-center gap-2">
                                    <History className="w-5 h-5 text-[#94A973]" /> Reschedule Logs
                                </h3>
                                <p className="text-xs text-gray-400 truncate mt-0.5">
                                    {channel?.name} <span className="font-mono">({id})</span>
                                    {!logsState.loading && !logsState.error &&
                                        ` · ${logsState.data.length} log${logsState.data.length === 1 ? '' : 's'}`}
                                </p>
                            </div>
                            <button onClick={() => setLogsOpen(false)} className="text-gray-400 hover:text-gray-600 shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {logsState.error ? (
                                <div className="m-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {logsState.error}
                                </div>
                            ) : logsState.loading ? (
                                <div className="p-12 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                                </div>
                            ) : logsState.data.length === 0 ? (
                                <div className="p-12 text-center text-gray-400 text-sm">
                                    No reschedule logs recorded for this channel.
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="text-xs font-bold text-[#6C755E] uppercase tracking-wide">
                                            <th className="p-3 w-48 bg-[#F4F5F0] border-b border-gray-200 sticky top-0">Timestamp</th>
                                            <th className="p-3 bg-[#F4F5F0] border-b border-gray-200 sticky top-0">Program</th>
                                            <th className="p-3 bg-[#F4F5F0] border-b border-gray-200 sticky top-0">What Changed</th>
                                            <th className="p-3 w-28 text-center bg-[#F4F5F0] border-b border-gray-200 sticky top-0">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {logsState.data.map(log => (
                                            <tr key={log.id} className="hover:bg-[#FAFAFA] transition-colors">
                                                <td className="p-3 text-sm text-gray-600 font-medium whitespace-nowrap">
                                                    {formatLogTime(log.createTime)}
                                                </td>
                                                <td className="p-3 font-semibold text-[#2C3325]">
                                                    {log.name || log.originalName || '—'}
                                                </td>
                                                <td className="p-3 text-sm text-[#6C755E]">
                                                    {logChangeSummary(log)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-md border ${logStatusStyle(log.status)}`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-[#FAFAFA] flex justify-end shrink-0">
                            <button
                                onClick={() => setLogsOpen(false)}
                                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* DELETE CONFIRMATION MODAL                                    */}
            {/* ============================================================ */}
            {deleteOpen && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-rose-50 rounded-full shrink-0">
                                    <Trash2 className="w-5 h-5 text-rose-600" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-[#2C3325]">Delete channel?</h3>
                                    <p className="text-sm text-[#6C755E] mt-1">
                                        This permanently deletes <span className="font-bold text-[#2C3325]">{channel?.name}</span>{' '}
                                        <span className="font-mono">({id})</span> along with its export IDs and source links.
                                        Its programs and reschedule logs are kept but unlinked. This cannot be undone.
                                    </p>
                                </div>
                            </div>

                            {deleteError && (
                                <div className="mt-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" /> {deleteError}
                                </div>
                            )}

                            <div className="flex gap-3 pt-5">
                                <button
                                    type="button"
                                    onClick={() => setDeleteOpen(false)}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {deleting ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </EditorLayout>
    );
}