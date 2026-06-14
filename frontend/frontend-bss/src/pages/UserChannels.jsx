import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2, Tv, ChevronLeft, ChevronRight, ChevronRight as ArrowIcon, AlertCircle,
} from 'lucide-react';
import UserLayout from '../components/UserLayout.jsx';
import { getUserChannels } from '../api/userApi.js';

const PAGE_SIZE = 24;

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

/**
 * USER channel browser — a friendly, read-only card grid of every channel.
 * The header search box (from UserLayout) drives a debounced, server-side
 * name/ID search. Clicking a card opens that channel's schedule. Users can
 * browse but not create/edit/delete channels.
 */
export default function UserChannels() {
    const navigate = useNavigate();

    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');

    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Debounce the header search (400ms) and reset to the first page.
    useEffect(() => {
        const t = setTimeout(() => {
            setDebounced(search);
            setPage(0);
        }, 400);
        return () => clearTimeout(t);
    }, [search]);

    // Fetch the current page whenever the search or page changes.
    useEffect(() => {
        let cancelled = false;
        const doFetch = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await getUserChannels({ search: debounced }, page, PAGE_SIZE);
                if (!cancelled) {
                    setChannels(data.content);
                    setTotalPages(data.totalPages);
                    setTotalElements(data.totalElements);
                }
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Failed to load channels.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        doFetch();
        return () => { cancelled = true; };
    }, [debounced, page]);

    const renderPageButtons = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => (
                <PageButton key={i} page={i} current={page} onClick={setPage} />
            ));
        }
        const pages = new Set([0, totalPages - 1, page]);
        for (let d = 1; d <= 2; d++) {
            if (page - d >= 0) pages.add(page - d);
            if (page + d < totalPages) pages.add(page + d);
        }
        const sorted = [...pages].sort((a, b) => a - b);
        const result = [];
        sorted.forEach((p, idx) => {
            if (idx > 0 && p - sorted[idx - 1] > 1) {
                result.push(<span key={`e-${p}`} className="px-1 text-gray-400">…</span>);
            }
            result.push(<PageButton key={p} page={p} current={page} onClick={setPage} />);
        });
        return result;
    };

    return (
        <UserLayout search={search} onSearchChange={setSearch}>
            <div className="space-y-5">
                <div>
                    <h2 className="text-2xl font-bold text-[#2C3325] flex items-center gap-2">
                        <Tv className="w-6 h-6 text-[#94A973]" /> Channels
                    </h2>
                    <p className="text-sm text-[#6C755E] mt-0.5">
                        Browse every channel and open its schedule. Search by name or ID in the bar above.
                    </p>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-28">
                        <Loader2 className="w-8 h-8 text-[#94A973] animate-spin" />
                    </div>
                ) : channels.length === 0 ? (
                    <div className="bg-white border border-dashed border-gray-200 rounded-xl p-16 text-center text-[#6C755E]">
                        {debounced
                            ? `No channels match “${debounced}”.`
                            : 'No channels available yet.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {channels.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => navigate(`/user/channels/${encodeURIComponent(c.id)}`)}
                                className="group text-left bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-[#94A973] hover:shadow-md transition-all flex flex-col"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-lg bg-[#E4E3CE]/70 flex items-center justify-center shrink-0">
                                        <Tv className="w-5 h-5 text-[#6C755E]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-[#2C3325] leading-snug truncate">{c.name}</h3>
                                        <p className="font-mono text-xs text-gray-400 truncate">{c.id}</p>
                                    </div>
                                </div>

                                <div className="mt-4 space-y-2 flex-1">
                                    <p className="text-xs text-[#6C755E]">
                                        <span className="font-semibold">Group:</span>{' '}
                                        {c.channelGroupName || <span className="text-gray-300">—</span>}
                                    </p>
                                    {c.sources?.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {c.sources.slice(0, 3).map((s) => (
                                                <span key={s.name} className="inline-flex items-center px-2 py-0.5 bg-[#F4F5F0] border border-[#E4E3CE] rounded text-[11px] font-semibold text-[#4A533E]">
                                                    {s.name}
                                                </span>
                                            ))}
                                            {c.sources.length > 3 && (
                                                <span className="text-[11px] text-gray-400 self-center">+{c.sources.length - 3}</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end text-sm font-semibold text-[#94A973] group-hover:text-[#4A533E] transition-colors">
                                    View schedule <ArrowIcon className="w-4 h-4 ml-1" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalElements > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500 pt-1">
                        <div>Showing {channels.length} of {totalElements} channels</div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {renderPageButtons()}
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </UserLayout>
    );
}