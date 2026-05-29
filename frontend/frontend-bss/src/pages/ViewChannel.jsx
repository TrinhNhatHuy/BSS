import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronRight, ChevronLeft, Calendar, RefreshCw, ArrowLeft, Clock,
    MonitorPlay, AlertCircle, Loader2
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getChannelById } from '../api/channelApi';
import { getProgramsForChannel } from '../api/programApi';

/** YYYYMMDDHHMMSS → "HH:MM" */
function formatTime(yyyymmddhhmmss) {
    if (!yyyymmddhhmmss || yyyymmddhhmmss.length < 12) return '—';
    return `${yyyymmddhhmmss.slice(8, 10)}:${yyyymmddhhmmss.slice(10, 12)}`;
}

/** Minutes between two YYYYMMDDHHMMSS values */
function durationMinutes(begin, end) {
    if (!begin || !end || begin.length < 12 || end.length < 12) return null;
    const toDate = (s) => new Date(
        +s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8),
        +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14) || 0
    );
    const diffMs = toDate(end) - toDate(begin);
    return diffMs > 0 ? Math.round(diffMs / 60000) : null;
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
    }, [id]);

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
            <div className="p-4 sm:p-6 lg:p-8">

                {/* Top: title + date navigator */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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

                    <div className="flex items-center gap-2">
                        {!isToday && (
                            <button
                                onClick={() => setSelectedDate(new Date())}
                                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-[#6C755E] font-medium transition-colors shadow-sm"
                            >
                                Today
                            </button>
                        )}
                        <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                            <button onClick={() => changeDate(-1)} className="p-2 text-[#6C755E] hover:bg-gray-50 rounded-md transition-colors" title="Previous day">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <label className="flex items-center gap-2 px-3 cursor-pointer">
                                <Calendar className="w-4 h-4 text-[#94A973]" />
                                <input
                                    type="date"
                                    value={toIsoDate(selectedDate)}
                                    onChange={onDateInputChange}
                                    className="bg-transparent font-semibold text-[#4A533E] text-sm outline-none cursor-pointer"
                                />
                            </label>
                            <button onClick={() => changeDate(1)} className="p-2 text-[#6C755E] hover:bg-gray-50 rounded-md transition-colors" title="Next day">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Channel error */}
                {channelError && (
                    <div className="mb-4 flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{channelError}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* LEFT: Channel info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <h3 className="font-bold text-[#2C3325] text-lg mb-4">Channel Details</h3>

                            {channelLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin text-[#94A973]" />
                            ) : channel ? (
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <p className="text-[#6C755E] font-medium mb-1">ID</p>
                                        <p className="font-mono font-semibold text-[#2C3325]">{channel.id}</p>
                                    </div>
                                    <div>
                                        <p className="text-[#6C755E] font-medium mb-1">Group</p>
                                        <p className="font-semibold text-[#2C3325]">
                                            {channel.channelGroupName || <span className="text-gray-300">—</span>}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[#6C755E] font-medium mb-1">Sources</p>
                                        <p className="text-[#2C3325]">
                                            {channel.sources?.length > 0
                                                ? channel.sources.map(s => s.name).join(', ')
                                                : <span className="text-gray-300">—</span>}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[#6C755E] font-medium mb-1">Export IDs</p>
                                        {channel.exportIds?.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {channel.exportIds.map(e => (
                                                    <span key={e.type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F4F5F0] border border-[#E4E3CE] rounded text-xs">
                                                        <span className="font-bold text-[#4A533E]">{e.type}</span>
                                                        <span className="font-mono text-gray-600">{e.externalId}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span className="text-gray-300 text-sm">—</span>}
                                    </div>
                                    <div>
                                        <p className="text-[#6C755E] font-medium mb-1">AI Status</p>
                                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${
                                            channel.aiUpdateStatus === 'UPDATED'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {channel.aiUpdateStatus === 'UPDATED' ? 'Updated' : 'Not Updated'}
                                        </span>
                                    </div>
                                    <div className="pt-4 border-t border-gray-100">
                                        <p className="text-[#6C755E] font-medium mb-1">Programs on selected date</p>
                                        <div className="bg-[#F4F5F0] p-3 rounded-lg border border-[#E4E3CE] mt-2">
                                            <p className="text-2xl font-bold text-[#4A533E]">{programs.length}</p>
                                            <p className="text-xs text-[#6C755E] mt-1">Total</p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <div className="mt-6">
                                <button
                                    onClick={() => setRefreshKey(k => k + 1)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#94A973] text-[#6C755E] font-medium rounded-lg hover:bg-[#F4F5F0] transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" /> Reload Programs
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Program timeline */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full min-h-[500px]">

                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-[#FAFAFA]">
                                <h3 className="font-bold text-[#2C3325]">
                                    Broadcast Timeline — {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </h3>
                            </div>

                            <div className="flex-1 overflow-y-auto">
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
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white border-b border-gray-100 text-xs font-bold text-[#6C755E] uppercase tracking-wide">
                                                <th className="p-4 w-28">Time</th>
                                                <th className="p-4">Program Details</th>
                                                <th className="p-4 hidden md:table-cell w-32">Category</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {programs.map(p => {
                                                const dur = durationMinutes(p.beginTime, p.endTime);
                                                return (
                                                    <tr key={p.id} className="hover:bg-[#FAFAFA] transition-colors">
                                                        <td className="p-4 align-top">
                                                            <div className="font-bold text-[#4A533E] text-base">{formatTime(p.beginTime)}</div>
                                                            <div className="text-xs text-[#6C755E] mt-1">
                                                                → {formatTime(p.endTime)}
                                                            </div>
                                                            {dur !== null && (
                                                                <div className="text-xs text-[#6C755E] mt-1 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> {dur} min
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <p className="font-semibold text-[#2C3325] text-base">
                                                                {p.name || <span className="text-gray-300 italic">(no title)</span>}
                                                            </p>
                                                            {p.content && (
                                                                <p className="text-xs text-[#6C755E] mt-1 line-clamp-2">{p.content}</p>
                                                            )}
                                                        </td>
                                                        <td className="p-4 align-top hidden md:table-cell">
                                                            {p.category ? (
                                                                <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-md border ${categoryColor(p.category)}`}>
                                                                    {p.category}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 text-sm">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </EditorLayout>
    );
}