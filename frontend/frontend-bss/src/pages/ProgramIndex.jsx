import React, { useState, useEffect } from 'react';
import {
    Search, ChevronLeft, ChevronRight as ChevronRightIcon,
    Loader2, AlertCircle, X
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getPrograms, getProgramCategories } from '../api/programApi';
import { getChannels } from '../api/channelApi';

const PAGE_SIZE = 20;

/** YYYYMMDDHHMMSS → "YYYY-MM-DD HH:MM" */
function formatBeginTime(s) {
    if (!s || s.length < 12) return '—';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

/** Minutes between two YYYYMMDDHHMMSS values, formatted as e.g. "45 min" or "2h 5m". */
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

function categoryStyle(category) {
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

export default function ProgramIndex() {
    // Per-column filter inputs (live values bound to inputs)
    const [nameQuery, setNameQuery] = useState('');
    const [contentQuery, setContentQuery] = useState('');
    const [channelFilter, setChannelFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Debounced snapshot — what we actually send to the API
    const [debouncedFilters, setDebouncedFilters] = useState({
        name: '', content: '', channelId: '', category: '',
        dateFrom: '', dateTo: '', status: ''
    });

    // Data state
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Lookups
    const [channels, setChannels] = useState([]);
    const [categories, setCategories] = useState([]);

    // Load channel + category dropdowns once
    useEffect(() => {
        getChannels({}, 0, 1000)
            .then(res => setChannels(res.content ?? []))
            .catch(() => setChannels([]));
        getProgramCategories()
            .then(setCategories)
            .catch(() => setCategories(['SeriesVN', 'SeriesFR', 'Kids', 'Music', 'Sports', 'News', 'Others']));
    }, []);

    // Debounce all filters together (400ms), reset to page 0 on change
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedFilters({
                name: nameQuery,
                content: contentQuery,
                channelId: channelFilter,
                category: categoryFilter,
                dateFrom,
                dateTo,
                status: statusFilter,
            });
            setCurrentPage(0);
        }, 400);
        return () => clearTimeout(t);
    }, [nameQuery, contentQuery, channelFilter, categoryFilter, dateFrom, dateTo, statusFilter]);

    // Fetch programs whenever filters or page changes
    useEffect(() => {
        let cancelled = false;
        const doFetch = async () => {
            setLoading(true);
            setFetchError(null);
            try {
                const data = await getPrograms(debouncedFilters, currentPage, PAGE_SIZE);
                if (!cancelled) {
                    setPrograms(data.content ?? []);
                    setTotalPages(data.totalPages ?? 0);
                    setTotalElements(data.totalElements ?? 0);
                }
            } catch (err) {
                if (!cancelled) {
                    setFetchError(err.response?.data?.message || 'Failed to load programs.');
                    setPrograms([]);
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

    const clearFilters = () => {
        setNameQuery('');
        setContentQuery('');
        setChannelFilter('');
        setCategoryFilter('');
        setDateFrom('');
        setDateTo('');
        setStatusFilter('');
    };

    const hasAnyFilter =
        nameQuery || contentQuery || channelFilter || categoryFilter ||
        dateFrom || dateTo || statusFilter;

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
            <span className="text-[#2C3325] font-bold">Programs</span>
        </>
    );

    return (
        <EditorLayout activeItem="programs" breadcrumb={breadcrumb}>
            <div className="p-6">

                {/* Filter bar */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-3">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1 min-w-0">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search program name..."
                                value={nameQuery}
                                onChange={(e) => setNameQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] focus:border-transparent outline-none text-sm"
                            />
                        </div>
                        <div className="relative flex-1 min-w-0">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search content..."
                                value={contentQuery}
                                onChange={(e) => setContentQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] focus:border-transparent outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3">
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value)}
                            className="px-3 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none text-sm font-medium text-gray-700 min-w-[160px]"
                        >
                            <option value="">All channels</option>
                            {channels.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.id})
                                </option>
                            ))}
                        </select>

                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none text-sm font-medium text-gray-700 min-w-[140px]"
                        >
                            <option value="">All categories</option>
                            {categories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none text-sm font-medium text-gray-700 min-w-[120px]"
                        >
                            <option value="">All statuses</option>
                            <option value="live">Live</option>
                            <option value="draft">Draft</option>
                        </select>

                        <div className="flex items-center gap-2 flex-1">
                            <label className="text-xs font-bold text-[#6C755E] whitespace-nowrap">From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="px-3 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none text-sm flex-1 min-w-0"
                            />
                            <label className="text-xs font-bold text-[#6C755E] whitespace-nowrap">To</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="px-3 py-2 bg-[#FAFAFA] border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none text-sm flex-1 min-w-0"
                            />
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

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-[#F4F5F0] border-b border-gray-200 text-xs font-bold text-[#6C755E] uppercase tracking-wider">
                                    <th className="p-4">Program Name</th>
                                    <th className="p-4">Channel</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4">Start Time</th>
                                    <th className="p-4">Duration</th>
                                    <th className="p-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="p-12 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                                        </td>
                                    </tr>
                                ) : programs.length > 0 ? (
                                    programs.map(program => (
                                        <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <p className="font-bold text-[#2C3325]">{program.name || '—'}</p>
                                                {program.content && (
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{program.content}</p>
                                                )}
                                            </td>
                                            <td className="p-4 text-[#6C755E] font-medium">
                                                {program.channelName || program.channelId || '—'}
                                                {program.channelName && (
                                                    <p className="text-xs text-gray-400 font-mono">{program.channelId}</p>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {program.category ? (
                                                    <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-md border ${categoryStyle(program.category)}`}>
                                                        {program.category}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 font-semibold text-[#4A533E] text-sm whitespace-nowrap">
                                                {formatBeginTime(program.beginTime)}
                                            </td>
                                            <td className="p-4 text-gray-600 text-sm">
                                                {formatDuration(program.beginTime, program.endTime)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full border ${
                                                    program.draftBatchId
                                                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                }`}>
                                                    {program.draftBatchId ? 'Draft' : 'Live'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-400">
                                            {hasAnyFilter
                                                ? 'No programs match the current filters.'
                                                : 'No programs in the database yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 bg-white">
                        <div>
                            {!loading && totalElements > 0 && `Showing ${programs.length} of ${totalElements} programs`}
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
        </EditorLayout>
    );
}