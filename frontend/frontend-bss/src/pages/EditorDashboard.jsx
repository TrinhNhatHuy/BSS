import { useEffect, useMemo, useState } from 'react';
import {
    CheckCircle, AlertCircle, Clock, Activity, RefreshCw, Loader2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import EditorLayout from '../components/EditorLayout';
import { getEditorDashboardSummary } from '../api/dashboardApi';

// --- helpers ---------------------------------------------------------------

const RANGE_LABEL = { day: 'today', week: 'last 7 days', month: 'last 30 days' };

const getStatusColor = (status) => {
    switch (status) {
        case 'Ready':   return 'text-emerald-700 bg-emerald-100';
        case 'Failed':  return 'text-rose-700 bg-rose-100';
        case 'Added':   return 'text-sky-700 bg-sky-100';
        case 'Removed': return 'text-rose-700 bg-rose-100';
        case 'Changed': return 'text-amber-700 bg-amber-100';
        default:        return 'text-gray-600 bg-gray-100';
    }
};

// reschedule_log.status (ADDED/MODIFIED/DELETED) → label used in the activity feed
const LOG_STATUS_LABEL = { ADDED: 'Added', MODIFIED: 'Changed', DELETED: 'Removed' };

/** "HH:mm" from a YYYYMMDDHHMMSS string, or '' if not parseable. */
const clockFromBeginTime = (s) =>
    s && s.length >= 12 ? `${s.slice(8, 10)}:${s.slice(10, 12)}` : '';

/** Best-effort time label for a reschedule log row. */
const logTime = (log) => {
    if (log.createTime) {
        const d = new Date(log.createTime);
        if (!Number.isNaN(d.getTime())) {
            return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
    }
    return clockFromBeginTime(log.beginTime || log.originalBeginTime) || '--:--';
};

/** Human sentence describing what changed. */
const logDetail = (log) => {
    const name = log.name || log.originalName || 'program';
    switch (log.status) {
        case 'ADDED':    return `Added "${name}"`;
        case 'DELETED':  return `Removed "${log.originalName || name}"`;
        case 'MODIFIED': return `Changed "${log.originalName || name}"`;
        default:         return name;
    }
};

// --- chart tooltip ---------------------------------------------------------

const ChartTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;
    return (
        <div className="bg-white rounded-lg border border-[#E4E3CE] shadow-md px-3 py-2 text-sm">
            <p className="font-semibold text-[#2C3325]">{row.channelName || row.channelId}</p>
            <p className="text-[#6C755E]">{row.channelId}</p>
            <p className="text-[#4A533E] font-medium mt-1">{row.programs} programs</p>
        </div>
    );
};

// --- component -------------------------------------------------------------

export default function EditorDashboard() {
    const [range, setRange] = useState('day');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await getEditorDashboardSummary(range);
                if (!cancelled) setData(res);
            } catch (err) {
                if (!cancelled) {
                    setError(err?.response?.data?.message || 'Failed to load dashboard data.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [range, reloadKey]);

    const programsByChannel = useMemo(() => data?.programsByChannel ?? [], [data]);
    const metrics = data?.metrics ?? {};
    const totalChannels = data?.totalChannels ?? 0;

    const totalPrograms = useMemo(
        () => programsByChannel.reduce((sum, c) => sum + (c.programs || 0), 0),
        [programsByChannel]
    );

    // Channels Status: surface the ones with no schedule first, then by volume.
    const channelsStatus = useMemo(() => {
        return [...programsByChannel].sort((a, b) => {
            const aHas = a.programs > 0 ? 1 : 0;
            const bHas = b.programs > 0 ? 1 : 0;
            if (aHas !== bHas) return aHas - bHas;     // 0-program channels first
            return b.programs - a.programs;
        });
    }, [programsByChannel]);

    const readyPct = totalChannels > 0
        ? Math.round((metrics.schedulesReady / totalChannels) * 100)
        : 0;

    // ~44px per bar so all ~42 channels stay legible; container scrolls horizontally.
    const chartWidth = Math.max(programsByChannel.length * 44, 600);

    const breadcrumb = <span className="text-[#2C3325] font-bold">Editor Dashboard</span>;

    return (
        <EditorLayout activeItem="dashboard" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 space-y-6">

                {error && (
                    <div className="flex items-center justify-between gap-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg">
                        <span className="text-sm font-medium">{error}</span>
                        <button
                            onClick={() => setReloadKey((k) => k + 1)}
                            className="text-sm font-semibold underline hover:no-underline"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Graph Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-[#2C3325]">Programs per Channel</h2>
                            <p className="text-sm text-[#6C755E]">
                                {loading
                                    ? 'Loading…'
                                    : <>Total <span className="font-semibold text-[#4A533E]">{totalChannels} channels</span> · <span className="font-semibold text-[#4A533E]">{totalPrograms} programs</span> scheduled {RANGE_LABEL[range]}</>}
                            </p>
                        </div>
                        <div className="flex bg-[#F4F5F0] rounded-lg p-1 border border-[#E4E3CE]">
                            {['day', 'week', 'month'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setRange(filter)}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${
                                        range === filter
                                            ? 'bg-white shadow-sm text-[#2C3325]'
                                            : 'text-[#6C755E] hover:text-[#4A533E]'
                                    }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-80 w-full overflow-x-auto">
                        {loading ? (
                            <div className="h-full w-full flex items-center justify-center text-[#6C755E]">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading chart…
                            </div>
                        ) : programsByChannel.length === 0 ? (
                            <div className="h-full w-full flex items-center justify-center text-[#6C755E] text-sm">
                                No channels to display.
                            </div>
                        ) : (
                            <div style={{ width: chartWidth, height: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={programsByChannel} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3CE" />
                                        <XAxis
                                            dataKey="channelId"
                                            axisLine={false}
                                            tickLine={false}
                                            interval={0}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                            tick={{ fontSize: 11, fill: '#6C755E' }}
                                        />
                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6C755E' }} />
                                        <Tooltip cursor={{ fill: '#F4F5F0' }} content={<ChartTooltip />} />
                                        <Bar dataKey="programs" fill="#94A973" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        label="Schedules Ready"
                        value={metrics.schedulesReady}
                        loading={loading}
                        sub={`${readyPct}% of ${totalChannels} channels`}
                        subClass="text-emerald-600"
                        icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
                        iconWrap="bg-emerald-50 border-emerald-100"
                    />
                    <MetricCard
                        label="Crawl Failures"
                        value={metrics.crawlFailures}
                        loading={loading}
                        sub={metrics.crawlFailures > 0 ? 'Channels with no schedule' : 'All channels covered'}
                        subClass={metrics.crawlFailures > 0 ? 'text-rose-600' : 'text-emerald-600'}
                        icon={<AlertCircle className="w-6 h-6 text-rose-600" />}
                        iconWrap="bg-rose-50 border-rose-100"
                    />
                    <MetricCard
                        label="Pending Review"
                        value={metrics.pendingReview}
                        loading={loading}
                        sub="AI drafts awaiting"
                        subClass="text-amber-600"
                        icon={<Clock className="w-6 h-6 text-amber-600" />}
                        iconWrap="bg-amber-50 border-amber-100"
                    />
                    <MetricCard
                        label="Reschedules"
                        value={metrics.reschedules}
                        loading={loading}
                        sub={`Changes logged ${RANGE_LABEL[range]}`}
                        subClass="text-sky-600"
                        icon={<Activity className="w-6 h-6 text-sky-600" />}
                        iconWrap="bg-sky-50 border-sky-100"
                    />
                </div>

                {/* Bottom Split */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col lg:flex-row">

                    <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-gray-100">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-[#2C3325]">Channels Status</h3>
                            <RefreshCw
                                className={`w-4 h-4 text-[#94A973] ${loading ? 'animate-spin' : ''}`}
                            />
                        </div>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                            {loading && channelsStatus.length === 0 ? (
                                <p className="text-sm text-[#6C755E]">Loading…</p>
                            ) : channelsStatus.length === 0 ? (
                                <p className="text-sm text-[#6C755E]">No channels.</p>
                            ) : (
                                channelsStatus.map((ch) => {
                                    const ready = ch.programs > 0;
                                    return (
                                        <div key={ch.channelId} className="flex items-center justify-between p-3 bg-[#FAFAFA] border border-gray-100 hover:border-[#E4E3CE] rounded-lg transition-colors">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-[#2C3325] truncate">{ch.channelName || ch.channelId}</p>
                                                <p className="text-xs text-[#6C755E] mt-0.5">
                                                    {ch.channelId} · {ch.programs} programs {RANGE_LABEL[range]}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full shrink-0 ${getStatusColor(ready ? 'Ready' : 'Failed')}`}>
                                                {ready ? 'Ready' : 'Failed'}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="flex-1 p-6">
                        <h3 className="text-lg font-bold text-[#2C3325] mb-5">Recent Reschedules</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                            {loading && !data ? (
                                <p className="text-sm text-[#6C755E]">Loading…</p>
                            ) : (data?.recentReschedules ?? []).length === 0 ? (
                                <p className="text-sm text-[#6C755E]">No reschedule activity yet.</p>
                            ) : (
                                data.recentReschedules.map((log) => (
                                    <div key={log.id} className="flex items-start gap-4 p-3 bg-[#FAFAFA] border border-gray-100 hover:border-[#E4E3CE] rounded-lg transition-colors">
                                        <p className="text-sm font-bold text-[#94A973] mt-0.5 w-12 shrink-0">{logTime(log)}</p>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-[#2C3325] truncate">{log.channelName || log.channelId || 'Unknown channel'}</p>
                                            <p className="text-sm text-[#6C755E] mt-0.5 truncate">{logDetail(log)}</p>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full shrink-0 ${getStatusColor(LOG_STATUS_LABEL[log.status])}`}>
                                            {LOG_STATUS_LABEL[log.status] || log.status}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </EditorLayout>
    );
}

// --- metric card -----------------------------------------------------------

function MetricCard({ label, value, sub, subClass, icon, iconWrap, loading }) {
    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-sm font-bold text-[#6C755E] uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-extrabold mt-2 text-[#2C3325]">
                    {loading ? '—' : (value ?? 0)}
                </p>
                <p className={`text-sm mt-1 font-medium ${subClass}`}>{sub}</p>
            </div>
            <div className={`p-3 rounded-lg border ${iconWrap}`}>{icon}</div>
        </div>
    );
}