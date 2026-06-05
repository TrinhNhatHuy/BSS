import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, LogOut, SlidersHorizontal } from 'lucide-react';
import useAuth from '../hooks/useAuth.js';

/**
 * Top header (BSS logo, search, notifications, avatar menu) plus an optional
 * horizontal category-chip bar, with a centered content slot. Mirrors the
 * mockup for the USER home page. Olive theme to match the rest of the app.
 *
 * Props:
 *   chips           — [{ key, label }] for the filter bar (omit to hide the bar)
 *   activeChip      — currently selected chip key
 *   onChipChange    — (key) => void
 *   search          — controlled search text
 *   onSearchChange  — (text) => void  (omit to render a read-only search box)
 *   children        — page body
 */

const initialsOf = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function UserLayout({
    chips,
    activeChip,
    onChipChange,
    search = '',
    onSearchChange,
    children,
}) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const onDoc = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    return (
        <div className="min-h-screen bg-[#FAFAFA] font-sans">

            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-4">
                    <h1 className="text-2xl font-bold text-[#2C3325] tracking-tight shrink-0">BSS</h1>

                    <div className="flex-1 max-w-2xl relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            placeholder="Search programs, channels..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#F4F5F0] border border-transparent focus:bg-white focus:border-[#94A973] focus:outline-none text-sm transition-colors"
                        />
                    </div>

                    <button className="relative p-2 text-[#4A533E] hover:bg-gray-100 rounded-full transition-colors" title="Notifications">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
                    </button>

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setMenuOpen((o) => !o)}
                            className="flex items-center gap-1.5 group"
                        >
                            <div className="w-9 h-9 rounded-full bg-[#94A973] text-white flex items-center justify-center text-sm font-bold shrink-0">
                                {initialsOf(user?.displayName || user?.username)}
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-[#4A533E]" />
                        </button>

                        {menuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-40">
                                <div className="px-4 py-2 border-b border-gray-100">
                                    <p className="text-sm font-semibold text-[#2C3325] truncate">
                                        {user?.displayName || user?.username}
                                    </p>
                                    <p className="text-xs text-gray-500">{user?.role}</p>
                                </div>
                                <button
                                    onClick={() => { setMenuOpen(false); navigate('/user/onboarding'); }}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#4A533E] hover:bg-gray-50 transition-colors"
                                >
                                    <SlidersHorizontal className="w-4 h-4" /> Edit preferences
                                </button>
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#B23B3B] hover:bg-red-50 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" /> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Category chips */}
            {chips && chips.length > 0 && (
                <div className="bg-[#E4E3CE]/70 border-b border-[#D4D3BE]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto">
                        {chips.map((c) => {
                            const active = activeChip === c.key;
                            return (
                                <button
                                    key={c.key}
                                    onClick={() => onChipChange?.(c.key)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${
                                        active
                                            ? 'bg-[#94A973] text-white border-[#94A973] shadow-sm'
                                            : 'bg-white text-[#4A533E] border-gray-200 hover:border-[#94A973]'
                                    }`}
                                >
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
        </div>
    );
}
