/**
 * The 7 program categories the model predicts — identical to the backend
 * Program.Category enum. `SeriesFR` covers all foreign series (SeriesCN/KR were
 * merged into it at training time), so we show it as "Series Intl".
 *
 * `badge` = tailwind classes for the small category pill on a program card.
 * `emoji` = used on the onboarding cards.
 */
export const CATEGORIES = [
    { key: 'SeriesVN', label: 'Series VN',   emoji: '🎭', badge: 'bg-rose-100 text-rose-700' },
    { key: 'SeriesFR', label: 'Series Intl', emoji: '🌏', badge: 'bg-violet-100 text-violet-700' },
    { key: 'Kids',     label: 'Kids',        emoji: '🧸', badge: 'bg-amber-100 text-amber-700' },
    { key: 'Music',    label: 'Music',       emoji: '🎵', badge: 'bg-pink-100 text-pink-700' },
    { key: 'Sports',   label: 'Sports',      emoji: '⚽', badge: 'bg-sky-100 text-sky-700' },
    { key: 'News',     label: 'News',        emoji: '📰', badge: 'bg-emerald-100 text-emerald-700' },
    { key: 'Others',   label: 'Others',      emoji: '📺', badge: 'bg-stone-200 text-stone-600' },
];

const META = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export const categoryLabel = (key) => META[key]?.label ?? key;
export const categoryBadge = (key) => META[key]?.badge ?? 'bg-stone-200 text-stone-600';
export const categoryEmoji = (key) => META[key]?.emoji ?? '📺';
