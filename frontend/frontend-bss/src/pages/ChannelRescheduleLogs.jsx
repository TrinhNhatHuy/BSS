import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon,
    Clock, Calendar, History, ArrowLeft, List as ListIcon,
    Eye, Info, Loader2, AlertCircle,
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getRescheduleLogs } from '../api/rescheduleLogApi';
import { getChannelById } from '../api/channelApi';

const PAGE_SIZE = 20;

/** YYYYMMDDHHMMSS → "YYYY-MM-DD HH:MM:SS" (null when missing/invalid). */
function formatProgramFull(s) {
    if (!s || s.length < 14) return null;
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/** ISO LocalDateTime ("2026-06-01T17:00:41") → "01/06/2026 17:00:41" ('—' if null). */
function formatScanTime(iso) {
    if (!iso) return '—';
    const [date, time] = iso.split('T');
    if (!date) return '—';
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y} ${(time || '').slice(0, 8)}`;
}

/** Status badge colours, reusing the project's reschedule-log palette. */
function statusBadge(status) {
    switch (status) {
        case 'ADDED':    return 'bg-sky-100 text-sky-700 border-sky-200';
        case 'MODIFIED': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'DELETED':  return 'bg-rose-100 text-rose-700 border-rose-200';
        default:         return 'bg-gray-100 text-gray-700 border-gray-200';
    }
}

function PageButton({ page, current, onClick }) {
    return (
        <button
            onClick={() => onClick(page)}
            className={`px-3 py-1 rounded text-sm font-medium ${
                page === current
                    ? 'bg-[#94A973] text-white'
                    : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
        >
            {page + 1}
        </button>
    );
}

export default function ChannelRescheduleLogs() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [channel, setChannel] = useState(null);

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Channel header info (name + id) — fetched once so the title shows even
    // when this channel has no logs at all.
    useEffect(() => {
        getChannelById(id).then(setChannel).catch(() => setChannel(null));
    }, [id]);

    // Logs for this channel, newest-first (server default sort = id DESC).
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getRescheduleLogs({ channelId: id }, currentPage, PAGE_SIZE);
                if (cancelled) return;
                setLogs(data.content ?? []);
                setTotalPages(data.totalPages ?? 0);
                setTotalElements(data.totalElements ?? 0);
            } catch (err) {
                if (cancelled) return;
                setError(err.response?.data?.message || 'Không tải được lịch sử thay đổi.');
                setLogs([]);
                setTotalPages(0);
                setTotalElements(0);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [id, currentPage]);

    const channelName = channel?.name || id;

    const breadcrumb = (
        <>
            <span onClick={() => navigate('/editor/channels')} className="cursor-pointer hover:text-[#4A533E]">Channels</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span onClick={() => navigate(`/editor/channels/${encodeURIComponent(id)}`)} className="cursor-pointer hover:text-[#4A533E]">{channelName}</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">Lịch sử thay đổi</span>
        </>
    );

    const rangeStart = totalElements === 0 ? 0 : currentPage * PAGE_SIZE + 1;
    const rangeEnd = currentPage * PAGE_SIZE + logs.length;

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
                result.push(<span key={`e-${p}`} className="px-1 text-gray-400">…</span>);
            }
            result.push(<PageButton key={p} page={p} current={currentPage} onClick={setCurrentPage} />);
        });
        return result;
    };

    return (
        <EditorLayout activeItem="channels" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-5">

                {/* Title */}
                <div className="flex items-baseline gap-3 flex-wrap border-b border-gray-200 pb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#2C3325] flex items-center gap-2">
                        <History className="w-7 h-7 text-[#94A973]" />
                        Lịch sử thay đổi lịch phát sóng — {channelName}
                    </h1>
                    <span className="text-[#6C755E] text-lg font-medium">
                        ({totalElements.toLocaleString()} bản ghi)
                    </span>
                </div>

                {/* Channel info banner */}
                <div className="flex items-center gap-2 p-4 rounded-lg bg-[#F4F5F0] border border-[#E4E3CE] text-[#4A533E] text-sm">
                    <Info className="w-4 h-4 shrink-0 text-[#94A973]" />
                    <span>
                        <strong>Thông tin kênh:</strong> {channelName} (ID: <span className="font-mono">{id}</span>)
                        {' '}— Tổng số lần thay đổi: <strong>{totalElements.toLocaleString()}</strong>
                    </span>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => navigate(`/editor/channels/${encodeURIComponent(id)}`)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-white border border-[#94A973] text-[#4A533E] hover:bg-[#F4F5F0] transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Quay về chi tiết kênh
                    </button>
                    <button
                        onClick={() => navigate('/editor/channels')}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-white border border-gray-200 text-[#4A533E] hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <ListIcon className="w-4 h-4" /> Danh sách kênh
                    </button>
                </div>

                {/* Count line */}
                <p className="text-sm text-[#6C755E]">
                    {loading
                        ? 'Đang tải…'
                        : `Showing ${rangeStart}-${rangeEnd} of ${totalElements.toLocaleString()} items.`}
                </p>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[960px]">
                            <thead>
                                <tr className="bg-[#F4F5F0] border-b border-gray-200 text-xs font-bold text-[#6C755E] uppercase tracking-wider">
                                    <th className="p-4 w-12">#</th>
                                    <th className="p-4 w-44">Thời gian quét</th>
                                    <th className="p-4 w-32">Trạng thái</th>
                                    <th className="p-4 w-72">Tên chương trình</th>
                                    <th className="p-4 w-32">Nội dung</th>
                                    <th className="p-4">Thời gian phát sóng</th>
                                    <th className="p-4 w-20 text-right">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="p-12 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                                        </td>
                                    </tr>
                                ) : logs.length > 0 ? (
                                    logs.map((log, idx) => {
                                        const newBegin = formatProgramFull(log.beginTime);
                                        const newEnd = formatProgramFull(log.endTime);
                                        const oldBegin = formatProgramFull(log.originalBeginTime);
                                        const oldEnd = formatProgramFull(log.originalEndTime);
                                        return (
                                            <tr key={log.id} className="hover:bg-[#FAFAFA] transition-colors align-top">
                                                <td className="p-4 text-[#6C755E] font-medium">
                                                    {currentPage * PAGE_SIZE + idx + 1}
                                                </td>
                                                <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Calendar className="w-4 h-4 text-[#94A973]" />
                                                        {formatScanTime(log.createTime || log.updateTime)}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-md border ${statusBadge(log.status)}`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-semibold text-[#2C3325] leading-snug">
                                                        {log.name || log.originalName || '—'}
                                                    </p>
                                                </td>
                                                <td className="p-4 text-sm text-[#6C755E]">
                                                    {log.content || log.originalContent || 'Không có'}
                                                </td>
                                                <td className="p-4 text-sm whitespace-nowrap">
                                                    <p className="flex items-center gap-1.5 font-semibold text-emerald-600">
                                                        <Clock className="w-4 h-4" />
                                                        {newBegin || 'N/A'} - {newEnd || 'N/A'}
                                                    </p>
                                                    <p className="flex items-center gap-1.5 text-rose-400 mt-0.5">
                                                        <Clock className="w-4 h-4" />
                                                        {oldBegin || 'N/A'} - {oldEnd || 'N/A'}
                                                    </p>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => navigate(`/editor/channels/${encodeURIComponent(id)}/reschedule-logs/${log.id}`)}
                                                        className="inline-flex items-center gap-1 text-[#94A973] hover:text-[#4A533E] font-medium text-sm transition-colors"
                                                        title="Xem chi tiết thay đổi"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        <span className="hidden sm:inline">Xem</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="p-12 text-center text-gray-400 text-sm">
                                            Kênh này chưa có lịch sử thay đổi nào.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-1 bg-white">
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
        </EditorLayout>
    );
}