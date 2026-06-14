import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Tv, Calendar, ChevronLeft, ChevronRight, RefreshCw,
    Loader2, AlertCircle, Bookmark, BookmarkCheck, Bell, Play,
} from 'lucide-react';
import UserLayout from '../components/UserLayout.jsx';
import ReminderCard from '../components/ReminderCard.jsx';
import { categoryBadge, categoryLabel } from '../utils/categories.js';
import {
    getUserChannel, getUserChannelPrograms, addBookmark, removeBookmark, getReminders,
    getWatchLink, logEvent,
} from '../api/userApi.js';

/** "HH:MM" from a YYYYMMDDHHMMSS string. */
const hhmm = (s) => (s && s.length >= 12 ? `${s.slice(8, 10)}:${s.slice(10, 12)}` : '--:--');

/** Date → "YYYY-MM-DD" (local) for both the API and <input type="date">. */
function toIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * USER "view channel" — a read-only daily schedule for one channel.
 *
 * Users pick a day, search the day's programs by name (header search box), and
 * the only per-program actions are Bookmark and Reminder. No edit/delete of any
 * channel or program data.
 */
export default function UserViewChannel() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [channel, setChannel] = useState(null);
    const [channelError, setChannelError] = useState('');

    const [programs, setPrograms] = useState([]);
    const [programsLoading, setProgramsLoading] = useState(true);
    const [programsError, setProgramsError] = useState('');

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [refreshKey, setRefreshKey] = useState(0);
    const [search, setSearch] = useState('');
    const [reminderProgram, setReminderProgram] = useState(null);
    const [reminderIds, setReminderIds] = useState(new Set());
    const [watchingId, setWatchingId] = useState(null);

    // Whether this channel is mapped to tv360 (a TV360 export id exists).
    const hasTv360 = useMemo(
        () => (channel?.exportIds || []).some((e) => e.type === 'TV360'),
        [channel],
    );

    // Channel detail (light meta only).
    useEffect(() => {
        let cancelled = false;
        getUserChannel(id)
            .then((data) => { if (!cancelled) setChannel(data); })
            .catch((err) => {
                if (!cancelled) setChannelError(err.response?.data?.message || 'Failed to load channel.');
            });
        return () => { cancelled = true; };
    }, [id]);

    // Programs for the selected day.
    useEffect(() => {
        let cancelled = false;
        const doFetch = async () => {
            setProgramsLoading(true);
            setProgramsError('');
            try {
                const data = await getUserChannelPrograms(id, toIsoDate(selectedDate));
                if (!cancelled) setPrograms(data);
            } catch (err) {
                if (!cancelled) setProgramsError(err.response?.data?.message || 'Failed to load schedule.');
            } finally {
                if (!cancelled) setProgramsLoading(false);
            }
        };
        doFetch();
        return () => { cancelled = true; };
    }, [id, selectedDate, refreshKey]);

    // Load which programs already have a reminder (for the bell's active state).
    useEffect(() => {
        let cancelled = false;
        getReminders()
            .then((list) => { if (!cancelled) setReminderIds(new Set(list.map((r) => r.programId))); })
            .catch(() => { /* best effort */ });
        return () => { cancelled = true; };
    }, []);

    const onReminderSaved = (saved) => {
        const pid = reminderProgram?.id;
        setReminderIds((prev) => {
            const next = new Set(prev);
            if (saved) next.add(saved.programId ?? pid);
            else if (pid != null) next.delete(pid);
            return next;
        });
    };

    const changeDate = (deltaDays) => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + deltaDays);
        setSelectedDate(next);
    };

    const onDateInputChange = (e) => {
        if (!e.target.value) return;
        const [y, m, d] = e.target.value.split('-').map(Number);
        setSelectedDate(new Date(y, m - 1, d));
    };

    const isToday = toIsoDate(selectedDate) === toIsoDate(new Date());

    // Client-side filter by program name (header search box).
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return programs;
        return programs.filter((p) => (p.name || '').toLowerCase().includes(q));
    }, [programs, search]);

    // Open the program on tv360. The pid is resolved server-side, so we open a
    // blank tab synchronously (inside the click, to dodge popup blockers) and
    // point it at the resolved URL once it's back.
    const openWatch = async (p) => {
        logEvent('WATCH', p.id); // strongest implicit signal: intent to watch this program
        const win = window.open('about:blank', '_blank');
        setWatchingId(p.id);
        try {
            const { available, url } = await getWatchLink(id, p.id);
            if (available && url) {
                if (win) { win.opener = null; win.location.href = url; }
                else window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                if (win) win.close();
                setProgramsError('This channel isn’t available on tv360 yet.');
            }
        } catch (err) {
            if (win) win.close();
            setProgramsError(err.response?.data?.message || 'Could not open tv360 for this program.');
        } finally {
            setWatchingId(null);
        }
    };

    // Optimistic bookmark toggle (mirrors UserHome).
    const toggleBookmark = async (p) => {
        const next = !p.bookmarked;
        setPrograms((prev) => prev.map((x) => (x.id === p.id ? { ...x, bookmarked: next } : x)));
        try {
            if (next) await addBookmark(p.id); else await removeBookmark(p.id);
        } catch {
            setPrograms((prev) => prev.map((x) => (x.id === p.id ? { ...x, bookmarked: !next } : x)));
        }
    };

    return (
        <UserLayout search={search} onSearchChange={setSearch}>
            <div className="space-y-5">

                {/* Back + title */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/user/channels')}
                        className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-[#6C755E] transition-colors shadow-sm"
                        title="Back to channels"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-2xl font-bold text-[#2C3325] flex items-center gap-2 truncate">
                            <Tv className="w-6 h-6 text-[#94A973] shrink-0" />
                            {channel?.name || id}
                        </h2>
                        <p className="text-sm text-[#6C755E] truncate">
                            <span className="font-mono">{id}</span>
                            {channel?.channelGroupName && <> · {channel.channelGroupName}</>}
                            {channel?.sources?.length > 0 && <> · {channel.sources.map((s) => s.name).join(', ')}</>}
                        </p>
                    </div>
                </div>

                {channelError && (
                    <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" /> {channelError}
                    </div>
                )}

                {/* Schedule card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[400px]">

                    {/* Card header: day label + date controls */}
                    <div className="p-4 border-b border-gray-100 bg-[#FAFAFA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <h3 className="font-bold text-[#2C3325]">
                            Schedule
                            <span className="text-[#6C755E] font-normal text-sm ml-2">
                                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                        </h3>

                        <div className="flex flex-wrap items-center gap-2">
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
                            <button
                                onClick={() => setRefreshKey((k) => k + 1)}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-[#94A973] text-[#6C755E] hover:text-[#4A533E] hover:bg-[#F4F5F0] font-medium rounded-lg transition-colors"
                                title="Reload schedule"
                            >
                                <RefreshCw className={`w-4 h-4 ${programsLoading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        </div>
                    </div>

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
                        ) : visible.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 text-sm">
                                {search.trim()
                                    ? `No programs match “${search.trim()}” on this day.`
                                    : 'No programs scheduled for this date.'}
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[640px]">
                                <thead>
                                    <tr className="bg-[#F4F5F0] border-b border-gray-200 text-xs font-bold text-[#6C755E] uppercase tracking-wide">
                                        <th className="p-4 w-28">Time</th>
                                        <th className="p-4">Program</th>
                                        <th className="p-4 w-36">Category</th>
                                        <th className="p-4 w-28 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visible.map((p) => (
                                        <tr key={p.id} className="hover:bg-[#FAFAFA] transition-colors">
                                            <td className="p-4 align-top whitespace-nowrap">
                                                <p className="font-mono text-sm font-bold text-[#2C3325]">{hhmm(p.beginTime)}</p>
                                                <p className="font-mono text-xs text-gray-400">{hhmm(p.endTime)}</p>
                                            </td>
                                            <td className="p-4 align-top">
                                                <p className="font-semibold text-[#2C3325]">{p.name || 'Untitled program'}</p>
                                                {p.content && (
                                                    <p className="text-sm text-[#6C755E] line-clamp-2 max-w-xl mt-0.5">{p.content}</p>
                                                )}
                                            </td>
                                            <td className="p-4 align-top">
                                                {p.category && (
                                                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-md ${categoryBadge(p.category)}`}>
                                                        {categoryLabel(p.category)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 align-top text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    {hasTv360 && (
                                                        <button
                                                            onClick={() => openWatch(p)}
                                                            disabled={watchingId === p.id}
                                                            className="p-1.5 rounded-md text-gray-400 hover:text-[#4A533E] hover:bg-gray-100 transition-colors disabled:opacity-60"
                                                            title="Watch on tv360"
                                                        >
                                                            {watchingId === p.id
                                                                ? <Loader2 className="w-5 h-5 animate-spin" />
                                                                : <Play className="w-5 h-5" />}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => toggleBookmark(p)}
                                                        className={`p-1.5 rounded-md transition-colors ${
                                                            p.bookmarked
                                                                ? 'text-[#94A973] bg-[#C3CEAA]/30'
                                                                : 'text-gray-400 hover:text-[#4A533E] hover:bg-gray-100'
                                                        }`}
                                                        title={p.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                                                    >
                                                        {p.bookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => setReminderProgram(p)}
                                                        className={`p-1.5 rounded-md transition-colors ${
                                                            reminderIds.has(p.id)
                                                                ? 'text-[#94A973] bg-[#C3CEAA]/30'
                                                                : 'text-gray-400 hover:text-[#4A533E] hover:bg-gray-100'
                                                        }`}
                                                        title={reminderIds.has(p.id) ? 'Edit reminder' : 'Set reminder'}
                                                    >
                                                        <Bell className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {reminderProgram && (
                <ReminderCard
                    program={reminderProgram}
                    onClose={() => setReminderProgram(null)}
                    onSaved={onReminderSaved}
                />
            )}
        </UserLayout>
    );
}