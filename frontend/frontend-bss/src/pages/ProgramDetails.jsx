import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronRight, ArrowLeft, AlertCircle, Loader2, Clock, MonitorPlay
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getProgramById } from '../api/programApi';

/** YYYYMMDDHHMMSS → "YYYY-MM-DD HH:MM:SS" */
function formatFull(s) {
    if (!s || s.length < 14) return '—';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/** Minutes between two YYYYMMDDHHMMSS values, as "45 min" / "1h 30m". */
function formatDuration(begin, end) {
    if (!begin || !end || begin.length < 12 || end.length < 12) return '—';
    const toDate = (s) => new Date(
        +s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8),
        +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14) || 0
    );
    const mins = Math.round((toDate(end) - toDate(begin)) / 60000);
    if (!mins || mins <= 0) return '—';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
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

function DetailItem({ label, children }) {
    return (
        <div>
            <p className="text-xs text-[#6C755E] font-medium uppercase tracking-wide mb-1">{label}</p>
            <div className="text-sm font-semibold text-[#2C3325]">{children}</div>
        </div>
    );
}

export default function ProgramDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [state, setState] = useState({ data: null, loading: true, error: null });
    const program = state.data;

    useEffect(() => {
        let cancelled = false;
        getProgramById(id)
            .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
            .catch(err => {
                if (!cancelled) setState({
                    data: null, loading: false,
                    error: err.response?.data?.message || 'Failed to load program.',
                });
            });
        return () => { cancelled = true; };
    }, [id]);

    const breadcrumb = (
        <>
            <span>Manage</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span onClick={() => navigate('/editor/programs')} className="cursor-pointer hover:text-[#4A533E]">Programs</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">{program?.name || `#${id}`}</span>
        </>
    );

    return (
        <EditorLayout activeItem="programs" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-[#6C755E] transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-2xl font-bold text-[#2C3325] flex items-center gap-2">
                        <MonitorPlay className="w-6 h-6 text-[#94A973]" />
                        Program Details
                    </h1>
                </div>

                {state.error && (
                    <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{state.error}</span>
                    </div>
                )}

                {state.loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                    </div>
                ) : program ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-6">

                        {/* Title + category */}
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-5">
                            <div>
                                <h2 className="text-xl font-bold text-[#2C3325]">
                                    {program.name || <span className="text-gray-300 italic">(no title)</span>}
                                </h2>
                                <p className="text-sm text-[#6C755E] mt-1">
                                    {program.channelName || program.channelId || '—'}
                                    {program.channelName && (
                                        <span className="font-mono text-gray-400 ml-1">({program.channelId})</span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {program.category && (
                                    <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-md border ${categoryColor(program.category)}`}>
                                        {program.category}
                                    </span>
                                )}
                                <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                                    program.draftBatchId
                                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}>
                                    {program.draftBatchId ? 'Draft' : 'Live'}
                                </span>
                            </div>
                        </div>

                        {/* Fields */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
                            <DetailItem label="Program ID"><span className="font-mono">{program.id}</span></DetailItem>
                            <DetailItem label="Channel">{program.channelName || program.channelId || '—'}</DetailItem>
                            <DetailItem label="Category">{program.category || '—'}</DetailItem>
                            <DetailItem label="Duration">
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-[#94A973]" />
                                    {formatDuration(program.beginTime, program.endTime)}
                                </span>
                            </DetailItem>
                            <DetailItem label="Start Time">{formatFull(program.beginTime)}</DetailItem>
                            <DetailItem label="End Time">{formatFull(program.endTime)}</DetailItem>
                        </div>

                        {/* Content */}
                        <div className="pt-2">
                            <p className="text-xs text-[#6C755E] font-medium uppercase tracking-wide mb-2">Content</p>
                            {program.content ? (
                                <p className="text-sm text-[#2C3325] leading-relaxed bg-[#FAFAFA] border border-gray-100 rounded-lg p-4">
                                    {program.content}
                                </p>
                            ) : (
                                <span className="text-sm text-gray-300">—</span>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </EditorLayout>
    );
}