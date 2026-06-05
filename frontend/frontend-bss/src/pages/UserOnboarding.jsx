import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { CATEGORIES } from '../utils/categories.js';
import { getPreferences, setPreferences } from '../api/userApi.js';

/**
 * First-login onboarding: pick 1–2 favourite categories. Also reachable later via
 * the avatar menu ("Edit preferences"), in which case it pre-selects the current
 * favourites. On save it stores the preferences and goes to the home page.
 */
export default function UserOnboarding() {
    const navigate = useNavigate();
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        getPreferences()
            .then((data) => { if (!cancelled) setSelected(data.categories || []); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const toggle = (key) => {
        setError('');
        setSelected((prev) => {
            if (prev.includes(key)) return prev.filter((k) => k !== key);
            if (prev.length >= 2) return prev;       // cap at 2
            return [...prev, key];
        });
    };

    const handleSave = async () => {
        if (selected.length < 1) { setError('Pick at least one category.'); return; }
        setSaving(true);
        setError('');
        try {
            await setPreferences(selected);
            navigate('/user/home', { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || 'Could not save your preferences. Try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <Loader2 className="w-8 h-8 text-[#94A973] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] font-sans flex flex-col">
            {/* simple branded header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-6 h-16 flex items-center">
                    <h1 className="text-2xl font-bold text-[#2C3325] tracking-tight">BSS</h1>
                </div>
            </header>

            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-3xl">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-[#2C3325] mb-2">What do you love to watch?</h2>
                        <p className="text-[#6C755E]">
                            Pick <span className="font-semibold text-[#4A533E]">1 or 2</span> favourite categories.
                            We'll put today's matching programs front and center.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {CATEGORIES.map((c) => {
                            const isSelected = selected.includes(c.key);
                            const disabled = !isSelected && selected.length >= 2;
                            return (
                                <button
                                    key={c.key}
                                    onClick={() => toggle(c.key)}
                                    disabled={disabled}
                                    className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all ${
                                        isSelected
                                            ? 'border-[#94A973] bg-[#C3CEAA]/30 shadow-sm'
                                            : disabled
                                                ? 'border-gray-100 bg-white opacity-50 cursor-not-allowed'
                                                : 'border-gray-200 bg-white hover:border-[#94A973] hover:shadow-sm'
                                    }`}
                                >
                                    {isSelected && (
                                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#94A973] text-white flex items-center justify-center">
                                            <Check className="w-4 h-4" />
                                        </span>
                                    )}
                                    <span className="text-4xl">{c.emoji}</span>
                                    <span className="text-sm font-semibold text-[#2C3325]">{c.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 justify-center mt-6 text-[#D54A4A] text-sm">
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    <div className="mt-8 flex flex-col items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving || selected.length < 1}
                            className="px-10 py-3 bg-[#94A973] hover:bg-[#8A9F6B] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-colors flex items-center gap-2"
                        >
                            {saving && <Loader2 size={18} className="animate-spin" />}
                            {saving ? 'Saving...' : 'Continue'}
                        </button>
                        <p className="text-xs text-[#6C755E]">{selected.length}/2 selected</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
