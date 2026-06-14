import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2, Bookmark, BookmarkCheck, Bell, Sparkles, X, CalendarDays,
    SlidersHorizontal, Tv, ChevronRight, Clock, Filter,
} from 'lucide-react';
import UserLayout from '../components/UserLayout.jsx';
import ReminderCard from '../components/ReminderCard.jsx';
import useAuth from '../hooks/useAuth.js';
import { categoryLabel, categoryBadge, categoryEmoji, CATEGORIES } from '../utils/categories.js';
import {
    getPreferences, getHome, getBookmarks, addBookmark, removeBookmark, getReminders,
    logEvent, logSearch, getWatchLink, getFilteredHome, getUserChannels,
} from '../api/userApi.js';

/** "HH:MM" from a YYYYMMDDHHMMSS string. */
const hhmm = (s) => (s && s.length >= 12 ? `${s.slice(8, 10)}:${s.slice(10, 12)}` : '--:--');

/** Date → "YYYY-MM-DD" (local). */
const toIsoDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const todayLabel = () =>
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const greetingFor = (h) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
const greetingEmoji = (h) => (h < 12 ? '☀️' : h < 18 ? '🌤️' : '🌙');

/** Stronger per-category accent for the card's top strip + emoji tile. */
const ACCENT = {
    SeriesVN: 'bg-rose-400', SeriesFR: 'bg-violet-400', Kids: 'bg-amber-400',
    Music: 'bg-pink-400', Sports: 'bg-sky-400', News: 'bg-emerald-400', Others: 'bg-stone-400',
};
const accentBar = (c) => ACCENT[c] || 'bg-[#94A973]';

const FIELD = 'px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-[#94A973] focus:outline-none';

const emptyFilters = () => ({
    q: '', category: '', channelId: '', bookmarked: '', reminded: '',
    date: toIsoDate(new Date()), timeStart: '', timeEnd: '',
});

export default function UserHome() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [preferences, setPreferences] = useState([]);
    const [personalized, setPersonalized] = useState(true);
    const [rails, setRails] = useState([]);
    const [upNext, setUpNext] = useState([]);
    const [bookmarks, setBookmarks] = useState([]);
    const [reminderIds, setReminderIds] = useState(new Set());
    const [reminderProgram, setReminderProgram] = useState(null);

    // Filter bar state.
    const [filters, setFilters] = useState(emptyFilters);
    const [channels, setChannels] = useState([]);
    const [filtered, setFiltered] = useState(null);   // null = show curated rails
    const [filterLoading, setFilterLoading] = useState(false);

    const todayIso = toIsoDate(new Date());
    const filtersActive = !!(filters.q || filters.category || filters.channelId || filters.bookmarked
        || filters.reminded || filters.timeStart || filters.timeEnd || filters.date !== todayIso);

    // Load preferences → (redirect brand-new users) → curated home + bookmarks + reminders.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const prefs = await getPreferences();
                if (cancelled) return;
                if ((prefs.categories || []).length === 0) {
                    navigate('/user/onboarding', { replace: true });
                    return;
                }
                const [home, bms, rems] = await Promise.all([
                    getHome(), getBookmarks(), getReminders().catch(() => []),
                ]);
                if (cancelled) return;
                setPreferences(home.preferences?.length ? home.preferences : prefs.categories);
                setPersonalized(home.personalized);
                setRails(home.rails || []);
                setUpNext(home.upNext || []);
                setBookmarks(bms || []);
                setReminderIds(new Set((rems || []).map((r) => r.programId)));
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Could not load your home.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [navigate]);

    // Channel options for the filter dropdown.
    useEffect(() => {
        getUserChannels({}, 0, 100).then((page) => setChannels(page.content || [])).catch(() => {});
    }, []);

    // Run the server-side filter (debounced) whenever a filter is active; clear back
    // to the curated rails when all filters are at their defaults. All state updates
    // happen inside the (async) timeout so none run synchronously in the effect body.
    const filterKey = JSON.stringify(filters);
    useEffect(() => {
        let cancelled = false;
        const t = setTimeout(async () => {
            if (cancelled) return;
            if (!filtersActive) { setFiltered(null); setFilterLoading(false); return; }
            setFilterLoading(true);
            try {
                const res = await getFilteredHome(filters);
                if (!cancelled) setFiltered(res || []);
            } catch {
                if (!cancelled) setFiltered([]);
            } finally {
                if (!cancelled) setFilterLoading(false);
            }
        }, filtersActive ? 350 : 0);
        return () => { cancelled = true; clearTimeout(t); };
    }, [filterKey, filtersActive]); // eslint-disable-line react-hooks/exhaustive-deps

    // Debounced search-keyword logging (feeds the recommender).
    useEffect(() => {
        const q = filters.q.trim();
        if (!q) return undefined;
        const t = setTimeout(() => logSearch(q), 700);
        return () => clearTimeout(t);
    }, [filters.q]);

    const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
    const clearFilters = () => setFilters(emptyFilters());

    const applyBookmark = (programId, val) => {
        const upd = (xs) => xs.map((x) => (x.id === programId ? { ...x, bookmarked: val } : x));
        setRails((prev) => prev.map((r) => ({ ...r, programs: upd(r.programs) })));
        setUpNext(upd);
        setFiltered((prev) => (prev ? upd(prev) : prev));
    };

    const toggleBookmark = async (p) => {
        const next = !p.bookmarked;
        applyBookmark(p.id, next);
        try {
            if (next) await addBookmark(p.id); else await removeBookmark(p.id);
            setBookmarks(await getBookmarks());
        } catch {
            applyBookmark(p.id, !next); // revert
        }
    };

    const removeBm = async (programId) => {
        setBookmarks((prev) => prev.filter((b) => b.programId !== programId));
        applyBookmark(programId, false);
        try { await removeBookmark(programId); } catch { /* best effort */ }
    };

    // Clicking a program watches it: resolve its tv360 link and open it directly.
    // The pid is resolved server-side, so we open a blank tab synchronously (inside
    // the click, to dodge popup blockers) and point it at the URL once it's back.
    // If the channel isn't on tv360, fall back to its schedule page.
    const openProgram = async (p) => {
        if (!p.channelId) return;
        logEvent('WATCH', p.id);
        const win = window.open('about:blank', '_blank');
        try {
            const { available, url } = await getWatchLink(p.channelId, p.id);
            if (available && url) {
                if (win) { win.opener = null; win.location.href = url; }
                else window.open(url, '_blank', 'noopener,noreferrer');
                return;
            }
            if (win) win.close();
            navigate(`/user/channels/${p.channelId}`); // not on tv360 — show the schedule
        } catch {
            if (win) win.close();
            navigate(`/user/channels/${p.channelId}`);
        }
    };

    const onReminderSaved = (saved) => {
        const pid = reminderProgram?.id;
        setReminderIds((prev) => {
            const next = new Set(prev);
            if (saved) next.add(saved.programId ?? pid);
            else if (pid != null) next.delete(pid);
            return next;
        });
    };

    if (loading) {
        return (
            <UserLayout search={filters.q} onSearchChange={(v) => setFilter('q', v)}>
                <div className="flex items-center justify-center py-32">
                    <Loader2 className="w-8 h-8 text-[#94A973] animate-spin" />
                </div>
            </UserLayout>
        );
    }

    const hour = new Date().getHours();

    return (
        <UserLayout search={filters.q} onSearchChange={(v) => setFilter('q', v)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main column */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Hero greeting */}
                    <div className="rounded-2xl p-6 bg-gradient-to-br from-[#94A973] to-[#6C755E] text-white shadow-sm">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            {greetingFor(hour)}, {user?.displayName || user?.username} {greetingEmoji(hour)}
                        </h2>
                        <p className="text-white/85 text-sm mt-1 flex items-center gap-1.5">
                            <CalendarDays className="w-4 h-4" /> {todayLabel()}
                            <span className="text-white/50">·</span>
                            {personalized ? 'Recommended from what you watch' : 'Popular picks to get you started'}
                        </p>
                    </div>

                    {/* Preferences */}
                    <div className="bg-[#E4E3CE]/60 rounded-2xl p-4 border border-[#D4D3BE] flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-bold text-[#2C3325]">Your picks:</span>
                        {preferences.map((key) => (
                            <span key={key} className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryBadge(key)}`}>
                                {categoryEmoji(key)} {categoryLabel(key)}
                            </span>
                        ))}
                        <button
                            onClick={() => navigate('/user/account?tab=preferences')}
                            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#6C755E] hover:text-[#4A533E]"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" /> Edit
                        </button>
                    </div>

                    {/* Filter bar */}
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-[#94A973]" />
                            <span className="text-sm font-bold text-[#2C3325]">Filter recommendations</span>
                            {filtersActive && (
                                <button
                                    onClick={clearFilters}
                                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#6C755E] hover:text-rose-500"
                                >
                                    <X className="w-3.5 h-3.5" /> Clear
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <input
                                value={filters.q}
                                onChange={(e) => setFilter('q', e.target.value)}
                                placeholder="Search name or content"
                                className={`${FIELD} flex-1 min-w-[10rem]`}
                            />
                            <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className={FIELD}>
                                <option value="">All categories</option>
                                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                            <select value={filters.channelId} onChange={(e) => setFilter('channelId', e.target.value)} className={`${FIELD} max-w-[12rem]`}>
                                <option value="">All channels</option>
                                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <input type="date" value={filters.date} onChange={(e) => setFilter('date', e.target.value)} className={FIELD} />
                            <div className="flex items-center gap-1">
                                <input type="time" value={filters.timeStart} onChange={(e) => setFilter('timeStart', e.target.value)} className={FIELD} title="From time" />
                                <span className="text-xs text-[#6C755E]">to</span>
                                <input type="time" value={filters.timeEnd} onChange={(e) => setFilter('timeEnd', e.target.value)} className={FIELD} title="To time" />
                            </div>
                            <select value={filters.bookmarked} onChange={(e) => setFilter('bookmarked', e.target.value)} className={FIELD}>
                                <option value="">Any bookmark</option>
                                <option value="true">Bookmarked</option>
                                <option value="false">Not bookmarked</option>
                            </select>
                            <select value={filters.reminded} onChange={(e) => setFilter('reminded', e.target.value)} className={FIELD}>
                                <option value="">Any reminder</option>
                                <option value="true">Reminder set</option>
                                <option value="false">No reminder</option>
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Filtered results OR curated rails */}
                    {filterLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-7 h-7 text-[#94A973] animate-spin" />
                        </div>
                    ) : filtered !== null ? (
                        <section className="space-y-3">
                            <div className="flex items-baseline gap-2">
                                <Filter className="w-5 h-5 text-[#94A973] self-center" />
                                <h3 className="text-xl font-bold text-[#2C3325]">Filtered results</h3>
                                <span className="text-sm text-[#6C755E]">
                                    · {filtered.length} program{filtered.length === 1 ? '' : 's'}
                                </span>
                            </div>
                            {filtered.length === 0 ? (
                                <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center text-[#6C755E]">
                                    No programs match your filters.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {filtered.map((p) => (
                                        <ProgramCard
                                            key={p.id}
                                            p={p}
                                            reminded={reminderIds.has(p.id)}
                                            onOpen={() => openProgram(p)}
                                            onToggleBookmark={() => toggleBookmark(p)}
                                            onReminder={() => setReminderProgram(p)}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    ) : rails.length === 0 ? (
                        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center text-[#6C755E]">
                            Nothing to recommend right now — check back later.
                        </div>
                    ) : (
                        rails.map((rail, idx) => (
                            <Rail
                                key={rail.key}
                                rail={rail}
                                first={idx === 0}
                                reminderIds={reminderIds}
                                onOpen={openProgram}
                                onToggleBookmark={toggleBookmark}
                                onReminder={setReminderProgram}
                            />
                        ))
                    )}

                    <button
                        onClick={() => navigate('/user/channels')}
                        className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#94A973] text-[#4A533E] font-semibold hover:bg-[#F4F5F0] transition-colors"
                    >
                        <Tv className="w-4 h-4" /> Browse all channels
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Right rail — scrollable so long bookmark/up-next lists are reachable */}
                <aside className="space-y-6 lg:sticky lg:top-24 self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">

                    {/* Bookmarks */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h3 className="text-base font-bold text-[#2C3325] mb-3 flex items-center gap-1.5">
                            <Bookmark className="w-4 h-4 text-[#94A973]" /> Bookmarked
                        </h3>
                        {bookmarks.length === 0 ? (
                            <p className="text-sm text-[#6C755E]">No bookmarks yet. Tap the bookmark icon on a program to save it.</p>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {bookmarks.map((b) => (
                                    <div key={b.programId} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-100 hover:border-[#E4E3CE]">
                                        <button
                                            onClick={() => navigate(`/user/channels/${b.channelId}`)}
                                            className="min-w-0 text-left"
                                            title="Open in channel"
                                        >
                                            <p className="text-sm font-semibold text-[#2C3325] truncate">{b.name || 'Untitled'}</p>
                                            <p className="text-xs text-[#6C755E] truncate">{hhmm(b.beginTime)} – {hhmm(b.endTime)} · {b.channelName || b.channelId}</p>
                                        </button>
                                        <button onClick={() => removeBm(b.programId)} className="p-1 text-gray-400 hover:text-rose-500 shrink-0" title="Remove">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Up Next */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h3 className="text-base font-bold text-[#2C3325] mb-3 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-[#94A973]" /> Up Next
                        </h3>
                        {upNext.length === 0 ? (
                            <p className="text-sm text-[#6C755E]">Nothing more scheduled today.</p>
                        ) : (
                            <div className="space-y-2">
                                {upNext.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => openProgram(p)}
                                        className="w-full text-left p-3 rounded-lg bg-[#FAFAF7] border border-gray-100 hover:border-[#94A973] transition-colors flex items-center gap-3"
                                    >
                                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${categoryBadge(p.category)}`}>
                                            {categoryEmoji(p.category)}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-[#2C3325] truncate">{p.name || 'Untitled'}</span>
                                            <span className="block text-xs text-[#6C755E] truncate">{hhmm(p.beginTime)} · {p.channelName || p.channelId}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
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

// --- a single recommendation shelf (horizontal scroll) ------------------------

function Rail({ rail, first, reminderIds, onOpen, onToggleBookmark, onReminder }) {
    return (
        <section className="space-y-3">
            <div className="flex items-baseline gap-2">
                {first && <Sparkles className="w-5 h-5 text-[#94A973] self-center" />}
                <h3 className="text-xl font-bold text-[#2C3325]">{rail.title}</h3>
                {rail.reason && <span className="text-xs text-[#6C755E]">· {rail.reason}</span>}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                {rail.programs.map((p) => (
                    <div key={p.id} className="snap-start shrink-0 w-72">
                        <ProgramCard
                            p={p}
                            reminded={reminderIds.has(p.id)}
                            onOpen={() => onOpen(p)}
                            onToggleBookmark={() => onToggleBookmark(p)}
                            onReminder={() => onReminder(p)}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}

// --- colorful program card ----------------------------------------------------

function ProgramCard({ p, onOpen, onToggleBookmark, onReminder, reminded }) {
    const conf = p.confidence != null ? Math.round(p.confidence * 100) : null;
    return (
        <div className="group h-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <div className={`h-1.5 ${accentBar(p.category)}`} />
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <button onClick={onOpen} className="flex items-start gap-3 flex-1 min-w-0 text-left" title="Watch on tv360">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${categoryBadge(p.category)}`}>
                            {categoryEmoji(p.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs font-bold text-[#94A973]">{hhmm(p.beginTime)} – {hhmm(p.endTime)}</p>
                            <h4 className="font-bold text-[#2C3325] leading-snug line-clamp-2">{p.name || 'Untitled program'}</h4>
                        </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={onToggleBookmark}
                            className={`p-1.5 rounded-md transition-colors ${
                                p.bookmarked ? 'text-[#94A973] bg-[#C3CEAA]/30' : 'text-gray-400 hover:text-[#4A533E] hover:bg-gray-100'
                            }`}
                            title={p.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                        >
                            {p.bookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={onReminder}
                            className={`p-1.5 rounded-md transition-colors ${
                                reminded ? 'text-[#94A973] bg-[#C3CEAA]/30' : 'text-gray-400 hover:text-[#4A533E] hover:bg-gray-100'
                            }`}
                            title={reminded ? 'Edit reminder' : 'Set reminder'}
                        >
                            <Bell className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {p.content && <p className="text-sm text-[#6C755E] mt-2 line-clamp-2">{p.content}</p>}

                <div className="flex items-center flex-wrap gap-2 mt-3">
                    {p.category && (
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${categoryBadge(p.category)}`}>
                            {categoryLabel(p.category)}
                        </span>
                    )}
                    <span className="text-xs text-[#6C755E] truncate">{p.channelName || p.channelId}</span>
                    {conf != null && (
                        <span
                            className="ml-auto text-[11px] font-semibold text-[#6C755E] bg-[#F4F5F0] px-2 py-0.5 rounded-full"
                            title={`Model confidence (softmax proxy)${p.margin != null ? ` · margin ${p.margin.toFixed(2)}` : ''}`}
                        >
                            AI {conf}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}