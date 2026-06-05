import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2, Bookmark, BookmarkCheck, Bell, Sparkles, X, CalendarDays,
} from 'lucide-react';
import UserLayout from '../components/UserLayout.jsx';
import { CATEGORIES, categoryLabel, categoryBadge, categoryEmoji } from '../utils/categories.js';
import {
    getPreferences, getHome, getBookmarks, addBookmark, removeBookmark,
} from '../api/userApi.js';

const FAV = '__fav__';

/** "HH:MM" from a YYYYMMDDHHMMSS string. */
const hhmm = (s) => (s && s.length >= 12 ? `${s.slice(8, 10)}:${s.slice(10, 12)}` : '--:--');

const todayLabel = () =>
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export default function UserHome() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [preferences, setPreferences] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [bookmarks, setBookmarks] = useState([]);

    const [activeChip, setActiveChip] = useState('All');
    const [search, setSearch] = useState('');

    // Load preferences → (redirect new users) → home + bookmarks.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const prefs = await getPreferences();
                if (cancelled) return;
                const favs = prefs.categories || [];
                if (favs.length === 0) {
                    navigate('/user/onboarding', { replace: true });
                    return;
                }
                setPreferences(favs);
                setActiveChip(FAV); // default returning users to their favourites

                const [home, bms] = await Promise.all([getHome(), getBookmarks()]);
                if (cancelled) return;
                setPreferences(home.preferences?.length ? home.preferences : favs);
                setPrograms(home.programs || []);
                setBookmarks(bms || []);
            } catch (err) {
                if (!cancelled) setError(err.response?.data?.message || 'Could not load your schedule.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [navigate]);

    const chips = useMemo(() => {
        const base = [{ key: 'All', label: 'All' }, ...CATEGORIES.map((c) => ({ key: c.key, label: c.label }))];
        return preferences.length > 0 ? [{ key: FAV, label: 'For You' }, ...base] : base;
    }, [preferences]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return programs.filter((p) => {
            const matchCat =
                activeChip === 'All' ? true
                    : activeChip === FAV ? preferences.includes(p.category)
                        : p.category === activeChip;
            const matchSearch = !q
                || (p.name || '').toLowerCase().includes(q)
                || (p.channelName || '').toLowerCase().includes(q);
            return matchCat && matchSearch;
        });
    }, [programs, activeChip, preferences, search]);

    // "Recommended": next upcoming programs in the user's favourite categories.
    const recommended = useMemo(() => {
        const now = new Date();
        const nowStr =
            `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}` +
            `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}00`;
        const fav = programs.filter((p) => preferences.includes(p.category));
        const upcoming = fav.filter((p) => (p.beginTime || '') >= nowStr);
        return (upcoming.length ? upcoming : fav).slice(0, 3);
    }, [programs, preferences]);

    const toggleBookmark = async (p) => {
        const next = !p.bookmarked;
        setPrograms((prev) => prev.map((x) => (x.id === p.id ? { ...x, bookmarked: next } : x)));
        try {
            if (next) await addBookmark(p.id); else await removeBookmark(p.id);
            setBookmarks(await getBookmarks());
        } catch {
            // revert on failure
            setPrograms((prev) => prev.map((x) => (x.id === p.id ? { ...x, bookmarked: !next } : x)));
        }
    };

    const removeBm = async (programId) => {
        setBookmarks((prev) => prev.filter((b) => b.programId !== programId));
        setPrograms((prev) => prev.map((x) => (x.id === programId ? { ...x, bookmarked: false } : x)));
        try { await removeBookmark(programId); } catch { /* best effort */ }
    };

    if (loading) {
        return (
            <UserLayout>
                <div className="flex items-center justify-center py-32">
                    <Loader2 className="w-8 h-8 text-[#94A973] animate-spin" />
                </div>
            </UserLayout>
        );
    }

    return (
        <UserLayout
            chips={chips}
            activeChip={activeChip}
            onChipChange={setActiveChip}
            search={search}
            onSearchChange={setSearch}
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left: Today's Schedule */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-end justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-[#2C3325]">Today's Schedule</h2>
                            <p className="text-sm text-[#6C755E] flex items-center gap-1.5 mt-0.5">
                                <CalendarDays className="w-4 h-4" /> {todayLabel()}
                                <span className="text-gray-300">·</span>
                                {visible.length} program{visible.length === 1 ? '' : 's'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {visible.length === 0 ? (
                        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center text-[#6C755E]">
                            No programs match this filter today.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {visible.map((p) => (
                                <ProgramCard key={p.id} p={p} onToggleBookmark={() => toggleBookmark(p)} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right rail */}
                <aside className="space-y-6 lg:sticky lg:top-24 self-start">

                    {/* Your Preferences */}
                    <div className="bg-[#E4E3CE]/60 rounded-2xl p-5 border border-[#D4D3BE]">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold text-[#2C3325]">Your Preferences</h3>
                            <button
                                onClick={() => navigate('/user/onboarding')}
                                className="text-xs font-semibold text-[#6C755E] hover:text-[#4A533E] underline"
                            >
                                Edit
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {preferences.map((key) => (
                                <span key={key} className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryBadge(key)}`}>
                                    {categoryEmoji(key)} {categoryLabel(key)}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Bookmarked Programs */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h3 className="text-base font-bold text-[#2C3325] mb-3">Bookmarked Programs</h3>
                        {bookmarks.length === 0 ? (
                            <p className="text-sm text-[#6C755E]">No bookmarks yet. Tap the bookmark icon on a program to save it.</p>
                        ) : (
                            <div className="space-y-2">
                                {bookmarks.map((b) => (
                                    <div key={b.programId} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-100 hover:border-[#E4E3CE]">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-[#2C3325] truncate">{b.name || 'Untitled'}</p>
                                            <p className="text-xs text-[#6C755E]">{hhmm(b.beginTime)} – {hhmm(b.endTime)} · {b.channelName || b.channelId}</p>
                                        </div>
                                        <button onClick={() => removeBm(b.programId)} className="p-1 text-gray-400 hover:text-rose-500 shrink-0" title="Remove">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recommended for You */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                        <h3 className="text-base font-bold text-[#2C3325] mb-3 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-[#94A973]" /> Recommended for You
                        </h3>
                        {recommended.length === 0 ? (
                            <p className="text-sm text-[#6C755E]">Nothing in your favourite categories today.</p>
                        ) : (
                            <div className="space-y-2">
                                {recommended.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setActiveChip(p.category)}
                                        className="w-full text-left p-3 rounded-lg bg-[#FAFAF7] border border-gray-100 hover:border-[#94A973] transition-colors"
                                    >
                                        <p className="text-sm font-semibold text-[#2C3325] truncate">{p.name || 'Untitled'}</p>
                                        <p className="text-xs text-[#6C755E]">
                                            {hhmm(p.beginTime)} · {categoryLabel(p.category)} · {p.channelName || p.channelId}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </UserLayout>
    );
}

// --- program card -----------------------------------------------------------

function ProgramCard({ p, onToggleBookmark }) {
    const conf = p.confidence != null ? Math.round(p.confidence * 100) : null;
    return (
        <div className={`bg-white rounded-xl border p-4 sm:p-5 flex gap-4 transition-shadow hover:shadow-sm ${
            p.bookmarked ? 'border-l-4 border-l-[#94A973] border-y-gray-100 border-r-gray-100' : 'border-gray-100'
        }`}>
            {/* time column */}
            <div className="shrink-0 w-14 text-right">
                <p className="font-mono text-sm font-bold text-[#2C3325]">{hhmm(p.beginTime)}</p>
                <p className="font-mono text-sm text-gray-400">{hhmm(p.endTime)}</p>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-[#2C3325] leading-snug">{p.name || 'Untitled program'}</h3>
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
                        <button className="p-1.5 rounded-md text-gray-400 hover:text-[#4A533E] hover:bg-gray-100" title="Reminder (coming soon)">
                            <Bell className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {p.content && (
                    <p className="text-sm text-[#6C755E] mt-1 line-clamp-2">{p.content}</p>
                )}

                <div className="flex items-center flex-wrap gap-2 mt-3">
                    {p.category && (
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${categoryBadge(p.category)}`}>
                            {categoryLabel(p.category)}
                        </span>
                    )}
                    <span className="text-xs text-[#6C755E]">{p.channelName || p.channelId}</span>
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