import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronRight, Sparkles, FileStack, Loader2, AlertCircle, Eye,
    Clock, RefreshCw, Filter, MonitorPlay,
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import DraftReviewModal from '../components/DraftReviewModal';
import { getDraftBatches } from '../api/draftBatchApi';

/** ISO LocalDateTime ("2026-05-24T14:30:22") → "2026-05-24 14:30:22" ('' if null) */
function formatDateTime(iso) {
    if (!iso) return '';
    return iso.replace('T', ' ').slice(0, 19);
}

function statusBadge(status) {
    return status === 'PROCESSING'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

/**
 * Drafts by AI — every pending AI draft across all channels in one place.
 *
 * Mirrors the AI Draft Schedules panel on ViewChannel but channel-agnostic:
 * a channel filter narrows the list, and Review opens the shared
 * DraftReviewModal (edit/delete rows, approve, delete whole draft) — the exact
 * same actions available from the channel page.
 */
export default function DraftsByAI() {
    const navigate = useNavigate();

    const [state, setState] = useState({ data: [], loading: true, error: null });
    const drafts = state.data;

    const [channelFilter, setChannelFilter] = useState('');   // '' = all channels
    const [reviewDraftId, setReviewDraftId] = useState(null);
    const [reloading, setReloading] = useState(false);

    // Initial load. State is only set in the async callbacks so this never trips
    // "synchronous setState in an effect"; later refreshes go through reload().
    useEffect(() => {
        let cancelled = false;
        getDraftBatches()
            .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
            .catch(err => {
                if (!cancelled) setState({
                    data: [], loading: false,
                    error: err.response?.data?.message || 'Failed to load drafts.',
                });
            });
        return () => { cancelled = true; };
    }, []);

    // Lightweight in-place reload used by the Refresh button and the review modal
    // callbacks (no full-page loading flicker). Not called from an effect.
    const reload = useCallback(() => {
        setReloading(true);
        return getDraftBatches()
            .then(data => setState(s => ({ ...s, data, error: null })))
            .catch(err => setState(s => ({ ...s, error: err.response?.data?.message || 'Failed to load drafts.' })))
            .finally(() => setReloading(false));
    }, []);

    // Distinct channels present in the drafts → the filter dropdown options.
    const channels = useMemo(() => {
        const map = new Map();
        drafts.forEach(d => { if (!map.has(d.channelId)) map.set(d.channelId, d.channelName || d.channelId); });
        return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [drafts]);

    const visible = useMemo(
        () => (channelFilter ? drafts.filter(d => d.channelId === channelFilter) : drafts),
        [drafts, channelFilter],
    );

    const breadcrumb = (
        <>
            <span>Manage</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">Drafts by AI</span>
        </>
    );

    return (
        <EditorLayout activeItem="drafts" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">

                {/* Title */}
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-[#2C3325] flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-[#94A973]" />
                        Drafts by AI
                    </h1>
                </div>

                <p className="text-sm text-[#6C755E] -mt-2">
                    AI-cleaned schedules awaiting review, across every channel. Review a draft to edit its
                    programs, then approve it (replaces that day's live schedule) or delete it.
                </p>

                {/* Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                    {/* Header: filter + count + refresh */}
                    <div className="p-4 border-b border-gray-100 bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <FileStack className="w-5 h-5 text-[#94A973]" />
                            <h3 className="font-bold text-[#2C3325]">Pending Drafts</h3>
                            <span className="text-xs font-semibold text-[#6C755E] bg-white border border-[#E4E3CE] rounded-full px-2 py-0.5">
                                {visible.length}{channelFilter ? ` of ${drafts.length}` : ''}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Channel filter */}
                            <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                                <Filter className="w-4 h-4 text-[#94A973]" />
                                <select
                                    value={channelFilter}
                                    onChange={(e) => setChannelFilter(e.target.value)}
                                    className="bg-transparent text-sm font-semibold text-[#4A533E] outline-none cursor-pointer"
                                >
                                    <option value="">All channels</option>
                                    {channels.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </label>

                            <button
                                onClick={reload}
                                disabled={reloading}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-[#94A973] text-[#6C755E] hover:text-[#4A533E] hover:bg-[#F4F5F0] font-medium rounded-lg transition-colors disabled:opacity-60"
                            >
                                <RefreshCw className={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        </div>
                    </div>

                    {state.error && (
                        <div className="m-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {state.error}
                        </div>
                    )}

                    {/* Body */}
                    {state.loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                        </div>
                    ) : visible.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 text-sm">
                            {drafts.length === 0
                                ? 'No AI drafts pending. Run “Clean with AI” on a channel to create one.'
                                : 'No drafts for this channel.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[760px]">
                                <thead>
                                    <tr className="bg-[#F4F5F0] border-b border-gray-200 text-xs font-bold text-[#6C755E] uppercase tracking-wide">
                                        <th className="p-4">Channel</th>
                                        <th className="p-4 w-32">Program Date</th>
                                        <th className="p-4 w-32">Status</th>
                                        <th className="p-4 w-28">Programs</th>
                                        <th className="p-4 w-48">Created</th>
                                        <th className="p-4 w-28 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visible.map(d => (
                                        <tr key={d.id} className="hover:bg-[#FAFAFA] transition-colors">
                                            <td className="p-4">
                                                <button
                                                    onClick={() => navigate(`/editor/channels/${encodeURIComponent(d.channelId)}`)}
                                                    className="inline-flex items-center gap-2 font-semibold text-[#2C3325] hover:text-[#4A533E]"
                                                    title="Open this channel"
                                                >
                                                    <MonitorPlay className="w-4 h-4 text-[#94A973]" />
                                                    {d.channelName || d.channelId}
                                                </button>
                                                <span className="block font-mono text-xs text-gray-400 mt-0.5">{d.channelId}</span>
                                            </td>
                                            <td className="p-4 font-semibold text-[#4A533E]">{d.programDate || '—'}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border ${statusBadge(d.status)}`}>
                                                    {d.status === 'PROCESSING' && <Loader2 className="w-3 h-3 animate-spin" />}
                                                    {d.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-[#4A533E] font-semibold">{d.programCount}</td>
                                            <td className="p-4 text-sm text-[#6C755E]">
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" /> {formatDateTime(d.createTime) || '—'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setReviewDraftId(d.id)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-[#94A973] text-white hover:bg-[#7e9460] transition-colors shadow-sm"
                                                    title="Review, edit, approve or delete this draft"
                                                >
                                                    <Eye className="w-4 h-4" /> Review
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Shared review modal — same actions as the channel page */}
            {reviewDraftId != null && (
                <DraftReviewModal
                    draftId={reviewDraftId}
                    onClose={() => setReviewDraftId(null)}
                    onChanged={reload}
                    onResolved={() => { setReviewDraftId(null); reload(); }}
                />
            )}
        </EditorLayout>
    );
}