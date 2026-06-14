import { useEffect, useState } from 'react';
import {
    Bell, X, Loader2, AlertCircle, Smartphone, Send, Check, Trash2, ExternalLink,
} from 'lucide-react';
import {
    getReminder, setReminder, deleteReminder,
    getPushPublicKey, subscribePush,
    getTelegramStatus,
} from '../api/userApi.js';
import { isPushSupported, ensurePushSubscription, notificationPermission } from '../utils/push.js';

const PRESETS = [
    { value: 0, label: 'At start' },
    { value: 5, label: '5 min' },
    { value: 10, label: '10 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hour' },
];

/** YYYYMMDDHHMMSS → Date (parsed as local wall-clock), or null. */
function parseBegin(s) {
    if (!s || s.length < 14) return null;
    const y = +s.slice(0, 4), mo = +s.slice(4, 6), d = +s.slice(6, 8);
    const h = +s.slice(8, 10), mi = +s.slice(10, 12), se = +s.slice(12, 14);
    const dt = new Date(y, mo - 1, d, h, mi, se);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatStart(s) {
    const dt = parseBegin(s);
    if (!dt) return '';
    return dt.toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    });
}

/** One selectable delivery-channel row. Declared at module scope (not during render). */
function ChannelOption({ icon, title, subtitle, disabled, selected, onSelect }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onSelect}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                selected ? 'border-[#94A973] bg-[#F4F5F0]' : 'border-gray-200 hover:border-[#C3CEAA]'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <span className={`mt-0.5 ${selected ? 'text-[#4A533E]' : 'text-gray-400'}`}>{icon}</span>
            <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-[#2C3325]">{title}</span>
                <span className="block text-xs text-[#6C755E]">{subtitle}</span>
            </span>
            {selected && <Check className="w-4 h-4 text-[#94A973] shrink-0 mt-0.5" />}
        </button>
    );
}

/**
 * Reminder modal — pick how long before a program starts to be notified and via
 * which free channel (this device via Web Push, Telegram, or both). Read-only
 * pages open this from the program's bell button.
 *
 * Props: program { id, name, beginTime, channelName }, onClose(), onSaved(reminder|null)
 */
export default function ReminderCard({ program, onClose, onSaved }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [existing, setExisting] = useState(null);
    const [minutesBefore, setMinutesBefore] = useState(10);
    const [channel, setChannel] = useState('WEBPUSH');

    const [push, setPush] = useState({ enabled: false, publicKey: '' });
    const [telegram, setTelegram] = useState({ available: false, connected: false, deepLink: null });
    const [started, setStarted] = useState(false);

    // Load existing reminder + channel availability.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [rem, pk, tg] = await Promise.all([
                    getReminder(program.id).catch(() => null),
                    getPushPublicKey().catch(() => ({ enabled: false, publicKey: '' })),
                    getTelegramStatus().catch(() => ({ available: false, connected: false })),
                ]);
                if (cancelled) return;
                setPush(pk);
                setTelegram(tg);
                const dt = parseBegin(program.beginTime);
                setStarted(dt ? dt.getTime() <= Date.now() : false);
                if (rem) {
                    setExisting(rem);
                    setMinutesBefore(rem.minutesBefore ?? 10);
                    setChannel(rem.channel ?? 'WEBPUSH');
                } else {
                    // Default to whichever channel is usable.
                    setChannel(pk.enabled && isPushSupported() ? 'WEBPUSH' : (tg.available ? 'TELEGRAM' : 'WEBPUSH'));
                }
            } catch {
                if (!cancelled) setError('Could not load reminder options.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [program.id, program.beginTime]);

    const recheckTelegram = async () => {
        try { setTelegram(await getTelegramStatus()); } catch { /* ignore */ }
    };

    const wantsPush = channel === 'WEBPUSH' || channel === 'BOTH';
    const wantsTelegram = channel === 'TELEGRAM' || channel === 'BOTH';

    const handleSave = async () => {
        setError('');
        setSaving(true);
        try {
            if (wantsPush) {
                if (!isPushSupported()) throw new Error('This browser does not support notifications.');
                if (!push.enabled) throw new Error('Push notifications are not configured on the server.');
                const sub = await ensurePushSubscription(push.publicKey);
                if (!sub) throw new Error('Allow notifications in your browser to use device reminders.');
                await subscribePush(sub);
            }
            if (wantsTelegram && !telegram.connected) {
                throw new Error('Connect Telegram first, then save.');
            }
            const saved = await setReminder({ programId: program.id, minutesBefore, channel });
            onSaved?.(saved);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to save reminder.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setError('');
        setDeleting(true);
        try {
            await deleteReminder(program.id);
            onSaved?.(null);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to remove reminder.');
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                    <h3 className="text-lg font-bold text-[#2C3325] flex items-center gap-2">
                        <Bell className="w-5 h-5 text-[#94A973]" /> Set a reminder
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <Loader2 className="w-7 h-7 animate-spin text-[#94A973]" />
                    </div>
                ) : (
                    <div className="p-5 space-y-5 overflow-y-auto">
                        {/* Program summary */}
                        <div>
                            <p className="font-semibold text-[#2C3325]">{program.name || 'Untitled program'}</p>
                            <p className="text-sm text-[#6C755E]">
                                Starts {formatStart(program.beginTime)}
                                {program.channelName ? ` · ${program.channelName}` : ''}
                            </p>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                            </div>
                        )}

                        {started ? (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" /> This program has already started.
                            </div>
                        ) : (
                            <>
                                {/* Timing */}
                                <div>
                                    <label className="block text-sm font-bold text-[#6C755E] mb-2">Notify me before it starts</label>
                                    <div className="flex flex-wrap gap-2">
                                        {PRESETS.map((p) => (
                                            <button
                                                key={p.value}
                                                type="button"
                                                onClick={() => setMinutesBefore(p.value)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                                    minutesBefore === p.value
                                                        ? 'bg-[#94A973] text-white border-[#94A973]'
                                                        : 'bg-white text-[#4A533E] border-gray-200 hover:border-[#94A973]'
                                                }`}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 mt-3 text-sm text-[#6C755E]">
                                        <span>Custom:</span>
                                        <input
                                            type="number"
                                            min={0}
                                            max={1440}
                                            value={minutesBefore}
                                            onChange={(e) => setMinutesBefore(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))}
                                            className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                        />
                                        <span>minutes before</span>
                                    </div>
                                </div>

                                {/* Channel */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-[#6C755E]">Notify via</label>

                                    <ChannelOption
                                        icon={<Smartphone className="w-5 h-5" />}
                                        title="This device / phone"
                                        subtitle={
                                            !isPushSupported() ? 'Not supported in this browser'
                                                : !push.enabled ? 'Push not configured on server'
                                                    : notificationPermission() === 'denied' ? 'Notifications blocked — allow them in browser settings'
                                                        : 'Browser/PWA notification'
                                        }
                                        disabled={!isPushSupported() || !push.enabled}
                                        selected={channel === 'WEBPUSH'}
                                        onSelect={() => setChannel('WEBPUSH')}
                                    />

                                    <ChannelOption
                                        icon={<Send className="w-5 h-5" />}
                                        title="Telegram"
                                        subtitle={
                                            !telegram.available ? 'Telegram not configured on server'
                                                : telegram.connected ? 'Connected'
                                                    : 'Connect your Telegram to use this'
                                        }
                                        disabled={!telegram.available}
                                        selected={channel === 'TELEGRAM'}
                                        onSelect={() => setChannel('TELEGRAM')}
                                    />

                                    <ChannelOption
                                        icon={<Bell className="w-5 h-5" />}
                                        title="Both"
                                        subtitle="Device push and Telegram"
                                        disabled={!telegram.available || !push.enabled || !isPushSupported()}
                                        selected={channel === 'BOTH'}
                                        onSelect={() => setChannel('BOTH')}
                                    />

                                    {/* Telegram connect prompt */}
                                    {wantsTelegram && telegram.available && !telegram.connected && (
                                        <div className="p-3 bg-[#F4F5F0] border border-[#E4E3CE] rounded-lg text-sm text-[#4A533E] space-y-2">
                                            <p>Open the bot, press <span className="font-semibold">Start</span>, then come back and save.</p>
                                            <div className="flex items-center gap-3">
                                                {telegram.deepLink && (
                                                    <a
                                                        href={telegram.deepLink}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 font-semibold text-[#94A973] hover:text-[#4A533E]"
                                                    >
                                                        <ExternalLink className="w-4 h-4" /> Connect Telegram
                                                    </a>
                                                )}
                                                <button onClick={recheckTelegram} className="text-[#6C755E] underline">
                                                    I&apos;ve connected
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Footer */}
                {!loading && (
                    <div className="flex gap-3 p-5 border-t border-gray-100 shrink-0">
                        {existing && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting || saving}
                                className="px-3 py-2 border border-rose-200 text-rose-600 font-medium rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-60 flex items-center gap-2"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Remove
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || deleting || started}
                            className="flex-1 px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {existing ? 'Update' : 'Set reminder'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}