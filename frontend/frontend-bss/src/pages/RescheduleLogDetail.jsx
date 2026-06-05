import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronRight, Clock, History, ArrowLeft, Eye, List as ListIcon,
    Info, ArrowRight, ArrowLeftCircle, Repeat, Loader2, AlertCircle,
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getRescheduleLogById } from '../api/rescheduleLogApi';

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

/** A clock-prefixed time value; greyed "N/A" when absent. */
function TimeValue({ value }) {
    if (!value) {
        return (
            <span className="inline-flex items-center gap-1.5 text-gray-400">
                <Clock className="w-4 h-4" /> N/A
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
            <Clock className="w-4 h-4" /> {value}
        </span>
    );
}

export default function RescheduleLogDetail() {
    const { id, logId } = useParams();
    const navigate = useNavigate();

    const [log, setLog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getRescheduleLogById(logId);
                if (!cancelled) setLog(data);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Không tải được chi tiết thay đổi.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [logId]);

    const channelName = log?.channelName || log?.channelId || id;

    const breadcrumb = (
        <>
            <span onClick={() => navigate('/editor/channels')} className="cursor-pointer hover:text-[#4A533E]">Channels</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span onClick={() => navigate(`/editor/channels/${encodeURIComponent(id)}`)} className="cursor-pointer hover:text-[#4A533E]">{channelName}</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span onClick={() => navigate(`/editor/channels/${encodeURIComponent(id)}/reschedule-logs`)} className="cursor-pointer hover:text-[#4A533E]">Lịch sử thay đổi</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">Chi tiết</span>
        </>
    );

    const newBegin = formatProgramFull(log?.beginTime);
    const newEnd = formatProgramFull(log?.endTime);
    const oldBegin = formatProgramFull(log?.originalBeginTime);
    const oldEnd = formatProgramFull(log?.originalEndTime);

    return (
        <EditorLayout activeItem="channels" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-5">

                {/* Title */}
                <div className="border-b border-gray-200 pb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#2C3325] flex items-center gap-2">
                        <History className="w-7 h-7 text-[#94A973]" />
                        Chi tiết thay đổi lịch phát sóng
                    </h1>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => navigate(`/editor/channels/${encodeURIComponent(id)}/reschedule-logs`)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-white border border-gray-200 text-[#4A533E] hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Quay lại lịch sử
                    </button>
                    <button
                        onClick={() => navigate(`/editor/channels/${encodeURIComponent(id)}`)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-[#94A973] text-white hover:bg-[#7e9460] transition-colors shadow-sm"
                    >
                        <Eye className="w-4 h-4" /> Xem chi tiết kênh
                    </button>
                    <button
                        onClick={() => navigate('/editor/channels')}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg bg-white border border-gray-200 text-[#4A533E] hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <ListIcon className="w-4 h-4" /> Danh sách kênh
                    </button>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                    </div>
                )}

                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                    </div>
                ) : log ? (
                    <>
                        {/* ---- Thông tin thay đổi ---- */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-[#94A973] text-white px-4 py-3 font-bold flex items-center gap-2">
                                <Info className="w-4 h-4" /> Thông tin thay đổi
                            </div>
                            <table className="w-full text-sm border-collapse">
                                <tbody>
                                    <tr className="border-b border-gray-200">
                                        <td className="bg-[#F4F5F0] font-bold text-[#4A533E] p-3 w-56 align-top">ID bản ghi</td>
                                        <td className="p-3 text-[#2C3325] font-mono">{log.id}</td>
                                    </tr>
                                    <tr className="border-b border-gray-200">
                                        <td className="bg-[#F4F5F0] font-bold text-[#4A533E] p-3 align-top">Thời gian thay đổi</td>
                                        <td className="p-3 text-[#2C3325]">{formatScanTime(log.createTime || log.updateTime)}</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-[#F4F5F0] font-bold text-[#4A533E] p-3 align-top">Kênh</td>
                                        <td className="p-3 text-[#2C3325]">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded bg-[#94A973] text-white text-xs font-bold">
                                                {log.channelName || log.channelId || '—'}
                                            </span>
                                            {log.channelId && (
                                                <span className="ml-2 text-[#6C755E] font-mono">({log.channelId})</span>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* ---- New vs Original ---- */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* New (after change) */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-emerald-600 text-white px-4 py-3 font-bold flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4" /> Thông tin mới (Sau khi thay đổi)
                                </div>
                                <div className="p-5 space-y-4">
                                    <div>
                                        <p className="text-sm font-bold text-[#4A533E]">Tên chương trình:</p>
                                        <p className="font-bold text-emerald-700 mt-1 break-words">{log.name || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#4A533E]">Nội dung:</p>
                                        <p className="text-[#6C755E] mt-1 break-words">{log.content || 'Không có'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#4A533E]">Thời gian bắt đầu:</p>
                                        <p className="mt-1"><TimeValue value={newBegin} /></p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#4A533E]">Thời gian kết thúc:</p>
                                        <p className="mt-1"><TimeValue value={newEnd} /></p>
                                    </div>
                                </div>
                            </div>

                            {/* Original (before change) */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-amber-500 text-white px-4 py-3 font-bold flex items-center gap-2">
                                    <ArrowLeftCircle className="w-4 h-4" /> Thông tin gốc (Trước khi thay đổi)
                                </div>
                                <div className="p-5 space-y-4">
                                    <div>
                                        <p className="text-sm font-bold text-[#4A533E]">Tên chương trình:</p>
                                        <p className="font-bold text-[#4A533E] mt-1 break-words">{log.originalName || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#4A533E]">Nội dung:</p>
                                        <p className="text-[#6C755E] mt-1 break-words">{log.originalContent || 'Không có'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#4A533E]">Thời gian bắt đầu:</p>
                                        <p className="mt-1"><TimeValue value={oldBegin} /></p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#4A533E]">Thời gian kết thúc:</p>
                                        <p className="mt-1"><TimeValue value={oldEnd} /></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ---- Change summary ---- */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-[#6C755E] text-white px-4 py-3 font-bold flex items-center gap-2">
                                <Repeat className="w-4 h-4" /> Tóm tắt thay đổi
                            </div>
                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <p className="text-sm font-bold text-[#4A533E] mb-1">Tên chương trình:</p>
                                    <div className="bg-[#F4F5F0] border-l-4 border-emerald-500 rounded p-3">
                                        <p className="font-bold text-emerald-700 break-words">{log.name || log.originalName || '—'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-[#4A533E] mb-1">Thời gian phát sóng:</p>
                                    <div className="bg-[#F4F5F0] border-l-4 border-[#94A973] rounded p-3">
                                        <p className="flex items-center gap-1.5 font-semibold text-emerald-600">
                                            <Clock className="w-4 h-4" /> {newBegin || 'N/A'} - {newEnd || 'N/A'}
                                        </p>
                                        <p className="flex items-center gap-1.5 text-rose-400 mt-0.5 line-through decoration-rose-400/70">
                                            <Clock className="w-4 h-4" /> {oldBegin || 'N/A'} - {oldEnd || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-sm font-bold text-[#4A533E] mb-1">Nội dung:</p>
                                    <div className="bg-[#F4F5F0] border-l-4 border-emerald-500 rounded p-3 space-y-1">
                                        <p className="text-[#2C3325]">
                                            <strong>Mới:</strong> {log.content || 'Không có'}
                                        </p>
                                        <p className="text-gray-400 line-through">
                                            <strong className="no-underline">Cũ:</strong> {log.originalContent || 'Không có'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : !error ? (
                    <div className="p-12 text-center text-gray-400 text-sm">Không tìm thấy bản ghi thay đổi.</div>
                ) : null}
            </div>
        </EditorLayout>
    );
}