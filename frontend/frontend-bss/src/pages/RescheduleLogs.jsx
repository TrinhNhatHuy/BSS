import React, { useState, useEffect } from 'react';
import {
    Search, ChevronLeft, ChevronRight as ChevronRightIcon,
    Loader2, AlertCircle, X, Eye, ArrowRight, Calendar, Filter
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getRescheduleLogs, getRescheduleLogStatuses } from '../api/rescheduleLogApi';
import { getChannels } from '../api/channelApi';

const PAGE_SIZE = 20;

/** YYYYMMDDHHMMSS → "YYYY-MM-DD HH:MM" */
function formatProgramTime(s) {
    if (!s || s.length < 12) return '—';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

/** ISO LocalDateTime ("2026-05-24T14:30:22") → "2026-05-24 14:30:22" */
function formatTimestamp(iso) {
    if (!iso) return '—';
    return iso.replace('T', ' ').slice(0, 19);
}

function statusStyle(status) {
    switch (status) {
        case 'ADDED':    return 'bg-sky-100 text-sky-700 border-sky-200';
        case 'MODIFIED': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'DELETED':  return 'bg-rose-100 text-rose-700 border-rose-200';
        default:         return 'bg-gray-100 text-gray-700 border-gray-200';
    }
}

/**
 * Build the per-field old → new diff rows for a log entry. Time fields are
 * formatted; a row is included only when the value actually changed (which
 * naturally yields "new only" for ADDED and "old only" for DELETED).
 */
function buildChanges(log) {
    const fields = [
        { label: 'Start Time', oldVal: log.originalBeginTime, newVal: log.beginTime, fmt: formatProgramTime },
        { label: 'End Time',   oldVal: log.originalEndTime,   newVal: log.endTime,   fmt: formatProgramTime },
        { label: 'Name',       oldVal: log.originalName,      newVal: log.name },
        { label: 'Content',    oldVal: log.originalContent,   newVal: log.content },
    ];
    return fields
        .filter(f => (f.oldVal ?? '') !== (f.newVal ?? ''))
        .map(f => ({
            label: f.label,
            old: f.oldVal == null || f.oldVal === '' ? null : (f.fmt ? f.fmt(f.oldVal) : f.oldVal),
            new: f.newVal == null || f.newVal === '' ? null : (f.fmt ? f.fmt(f.newVal) : f.newVal),
        }));
}

/** One-line summary of what changed, shown under the program name in the table. */
function changeSummary(log) {
    const changes = buildChanges(log);
    if (changes.length === 0) return '—';
    if (log.status === 'ADDED')   return 'New program entry added';
    if (log.status === 'DELETED') return 'Program removed from schedule';
    return changes.map(c => c.label).join(', ') + ' updated';
}

function PageButton({ page, current, onClick }) {
    return (
        <button
            onClick={() => onClick(page)}
            className={`px-3 py-1 rounded font-medium text-sm ${
                page === current
                    ? 'bg-[#94A973] text-white'
                    : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
        >
            {page + 1}
        </button>
    );
}

export default function RescheduleLogs() {
    // Live filter inputs
    const [searchQuery, setSearchQuery] = useState('');
    const [channelFilter, setChannelFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Debounced snapshot — what we actually send to the API
    const [debouncedFilters, setDebouncedFilters] = useState({
        q: '', channelId: '', status: '', dateFrom: '', dateTo: '',
    });

    // Data state
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Lookups
    const [channels, setChannels] = useState([]);
    const [statuses, setStatuses] = useState([]);

    // Modal
    const [selectedLog, setSelectedLog] = useState(null);

    // Load channel + status dropdowns once
    useEffect(() => {
        getChannels({}, 0, 1000)
            .then(res => setChannels(res.content ?? []))
            .catch(() => setChannels([]));
        getRescheduleLogStatuses()
            .then(setStatuses)
            .catch(() => setStatuses(['ADDED', 'MODIFIED', 'DELETED']));
    }, []);

    // Debounce filters together (400ms); a single date maps to dateFrom == dateTo
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedFilters({
                q: searchQuery,
                channelId: channelFilter,
                status: statusFilter,
                dateFrom: dateFilter,
                dateTo: dateFilter,
            });
            setCurrentPage(0);
        }, 400);
        return () => clearTimeout(t);
    }, [searchQuery, channelFilter, statusFilter, dateFilter]);

    // Fetch logs whenever filters or page change
    useEffect(() => {
        let cancelled = false;
        const doFetch = async () => {
            setLoading(true);
            setFetchError(null);
            try {
                const data = await getRescheduleLogs(debouncedFilters, currentPage, PAGE_SIZE);
                if (!cancelled) {
                    setLogs(data.content ?? []);
                    setTotalPages(data.totalPages ?? 0);
                    setTotalElements(data.totalElements ?? 0);
                }
            } catch (err) {
                if (!cancelled) {
                    setFetchError(err.response?.data?.message || 'Failed to load reschedule logs.');
                    setLogs([]);
                    setTotalPages(0);
                    setTotalElements(0);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        doFetch();
        return () => { cancelled = true; };
    }, [debouncedFilters, currentPage]);

    const hasAnyFilter = searchQuery || channelFilter || statusFilter || dateFilter;

    const clearFilters = () => {
        setSearchQuery('');
        setChannelFilter('');
        setStatusFilter('');
        setDateFilter('');
    };

    const renderPageButtons = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => (
                <PageButton key={i} page={i} current={currentPage} onClick={setCurrentPage} />
            ));
        }
        const pages = new Set([0, totalPages - 1, currentPage]);
        for (let d = 1; d <= 2; d++) {
            if (currentPage - d >= 0) pages.add(currentPage - d);
            if (currentPage + d < totalPages) pages.add(currentPage + d);
        }
        const sorted = [...pages].sort((a, b) => a - b);
        const result = [];
        sorted.forEach((p, idx) => {
            if (idx > 0 && p - sorted[idx - 1] > 1) {
                result.push(<span key={`ellipsis-${p}`} className="px-1 text-gray-400">…</span>);
            }
            result.push(<PageButton key={p} page={p} current={currentPage} onClick={setCurrentPage} />);
        });
        return result;
    };

    const breadcrumb = (
        <>
            <span>Manage</span>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">Reschedule Logs</span>
        </>
    );

    const selectedChanges = selectedLog ? buildChanges(selectedLog) : [];

    return (
        <EditorLayout activeItem="reschedule-logs" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6">

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#2C3325]">System Reschedule Logs</h1>
                    <p className="text-sm text-[#6C755E] mt-1">Immutable tracking of all automated and manual schedule changes.</p>
                </div>

                {/* Filter bar */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex flex-col sm:flex-row flex-wrap w-full lg:w-auto gap-3">
                        {/* Search */}
                        <div className="relative w-full sm:w-64">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search program name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none transition-all text-sm"
                            />
                        </div>

                        {/* Channel */}
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value)}
                            className="px-3 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none text-sm font-medium text-gray-700 min-w-[160px]"
                        >
                            <option value="">All channels</option>
                            {channels.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                            ))}
                        </select>

                        {/* Date */}
                        <div className="relative">
                            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none text-sm font-medium text-gray-700"
                            />
                        </div>

                        {/* Status */}
                        <div className="relative">
                            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="pl-9 pr-8 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none appearance-none text-sm font-medium text-gray-700"
                            >
                                <option value="">All statuses</option>
                                {statuses.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        {hasAnyFilter && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-[#6C755E] hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
                                title="Clear all filters"
                            >
                                <X className="w-4 h-4" /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Error banner */}
                {fetchError && (
                    <div className="mb-4 flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{fetchError}</span>
                    </div>
                )}

                {/* Data Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-[#F4F5F0] border-b border-gray-200 text-xs font-bold text-[#6C755E] uppercase tracking-wider">
                                    <th className="p-4 w-48">Timestamp</th>
                                    <th className="p-4 w-32">Channel</th>
                                    <th className="p-4">Program Details</th>
                                    <th className="p-4 w-32 text-center">Action Status</th>
                                    <th className="p-4 w-24 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="p-12 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                                        </td>
                                    </tr>
                                ) : logs.length > 0 ? (
                                    logs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                                                {formatTimestamp(log.createTime)}
                                            </td>
                                            <td className="p-4 font-bold text-[#4A533E]">
                                                {log.channelName || log.channelId || '—'}
                                            </td>
                                            <td className="p-4">
                                                <p className="font-semibold text-[#2C3325]">
                                                    {log.name || log.originalName || '—'}
                                                </p>
                                                <p className="text-xs text-[#6C755E] mt-0.5">{changeSummary(log)}</p>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-md border ${statusStyle(log.status)}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="flex items-center justify-end gap-1 w-full text-[#94A973] hover:text-[#4A533E] font-medium text-sm transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    <span className="hidden sm:inline">View</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-gray-400">
                                            {hasAnyFilter
                                                ? 'No logs match the current filters.'
                                                : 'No reschedule logs recorded yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 bg-white">
                        <div>
                            {!loading && totalElements > 0 && `Showing ${logs.length} of ${totalElements} logs`}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                    disabled={currentPage === 0}
                                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {renderPageButtons()}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={currentPage >= totalPages - 1}
                                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronRightIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* VIEW DETAILS MODAL */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

                        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#FAFAFA] shrink-0">
                            <h3 className="text-lg font-bold text-[#2C3325]">Log Details</h3>
                            <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-4 text-sm">
                                <div className="flex-1 min-w-[120px] bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p className="text-gray-500 mb-1 font-medium">Log ID</p>
                                    <p className="font-bold text-[#2C3325]">#{selectedLog.id}</p>
                                </div>
                                <div className="flex-1 min-w-[120px] bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p className="text-gray-500 mb-1 font-medium">Timestamp</p>
                                    <p className="font-bold text-[#2C3325]">{formatTimestamp(selectedLog.createTime)}</p>
                                </div>
                            </div>

                            {/* Program Info */}
                            <div>
                                <h4 className="text-sm font-bold text-[#6C755E] uppercase tracking-wide mb-2">Affected Program</h4>
                                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                    <div>
                                        <p className="font-bold text-lg text-[#2C3325]">
                                            {selectedLog.name || selectedLog.originalName || '—'}
                                        </p>
                                        <p className="text-[#6C755E] text-sm mt-0.5">
                                            {selectedLog.channelName || selectedLog.channelId || '—'}
                                        </p>
                                    </div>
                                    <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-md border ${statusStyle(selectedLog.status)}`}>
                                        {selectedLog.status}
                                    </span>
                                </div>
                            </div>

                            {/* Changes Comparison */}
                            <div>
                                <h4 className="text-sm font-bold text-[#6C755E] uppercase tracking-wide mb-3">Detected Changes</h4>
                                {selectedChanges.length === 0 ? (
                                    <p className="text-sm text-gray-400 bg-gray-50 rounded-lg border border-gray-100 p-4 text-center">
                                        No field-level differences recorded.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedChanges.map(change => (
                                            <div key={change.label} className="bg-[#F4F5F0] rounded-xl border border-[#E4E3CE] p-4">
                                                <p className="font-bold text-[#4A533E] mb-3 border-b border-[#D4D3BE] pb-2">
                                                    {change.label}
                                                </p>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex-1 bg-white p-3 rounded-lg shadow-sm border border-rose-100 text-center">
                                                        <p className="text-xs text-rose-500 font-bold uppercase mb-1">Old Value</p>
                                                        <p className="font-semibold text-gray-700 break-words">
                                                            {change.old == null
                                                                ? <span className="italic text-gray-400">None</span>
                                                                : <span className="line-through decoration-rose-400">{change.old}</span>}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-[#94A973]">
                                                        <ArrowRight className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1 bg-white p-3 rounded-lg shadow-sm border border-emerald-100 text-center">
                                                        <p className="text-xs text-emerald-500 font-bold uppercase mb-1">New Value</p>
                                                        <p className="font-bold text-[#2C3325] break-words">
                                                            {change.new == null
                                                                ? <span className="italic text-gray-400 font-normal">None</span>
                                                                : change.new}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 bg-[#FAFAFA] flex justify-end shrink-0">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </EditorLayout>
    );
}