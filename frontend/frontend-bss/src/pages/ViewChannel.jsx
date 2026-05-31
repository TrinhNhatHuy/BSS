import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronRight, ChevronLeft, Calendar, RefreshCw, ArrowLeft,
    MonitorPlay, AlertCircle, Loader2, Sparkles, Eye, History, FileSpreadsheet
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getChannelById } from '../api/channelApi';
import { getProgramsForChannel } from '../api/programApi';

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
        </EditorLayout>
    );
}