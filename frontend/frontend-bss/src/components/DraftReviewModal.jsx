import { useState, useEffect, useCallback } from 'react';
import {
    X, AlertCircle, Loader2, Edit2, Trash2, Save, Check,
    Sparkles, CheckCircle2,
} from 'lucide-react';
import { getDraftBatch, deleteDraftBatch, approveDraftBatch } from '../api/draftBatchApi';
import { updateProgram, deleteProgram } from '../api/programApi';

const CATEGORIES = ['SeriesVN', 'SeriesFR', 'Kids', 'Music', 'Sports', 'News', 'Others'];

/** YYYYMMDDHHMMSS → "YYYY-MM-DD HH:MM:SS" ('—' if missing). */
function formatFull(s) {
    if (!s || s.length < 14) return '—';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/** YYYYMMDDHHMMSS → "YYYY-MM-DDTHH:MM:SS" for a datetime-local input. */
function toInputDateTime(s) {
    if (!s || s.length < 14) return '';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/** datetime-local value → 14-char YYYYMMDDHHMMSS. */
function fromInputDateTime(v) {
    if (!v) return '';
    const digits = v.replace(/[^0-9]/g, '');
    return digits.padEnd(14, '0').slice(0, 14);
}

function categoryColor(category) {
    switch (category) {
        case 'News':     return 'bg-sky-50 text-sky-700 border-sky-200';
        case 'Sports':   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'Music':    return 'bg-violet-50 text-violet-700 border-violet-200';
        case 'Kids':     return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'SeriesVN':
        case 'SeriesFR': return 'bg-rose-50 text-rose-700 border-rose-200';
        default:         return 'bg-gray-50 text-gray-600 border-gray-200';
    }
}

const EMPTY_EDIT = { name: '', content: '', category: '', beginTime: '', endTime: '' };

/**
 * Review modal for one AI draft batch.
 *
 * Lets the editor inspect the cleaned programs, edit/delete individual rows,
 * then either DELETE the whole draft or APPROVE it (cleaned schedule replaces
 * the live one for the day). Row edits/deletes reuse the standard program
 * endpoints; whole-draft actions use the draft-batch endpoints.
 *
 * Props:
 *   draftId      — batch id to load
 *   onClose()    — close the modal
 *   onChanged()  — a row was edited/deleted (parent refreshes the batch list)
 *   onResolved() — the whole draft was approved or deleted (parent refreshes
 *                  the batch list AND the live schedule, then closes)
 */
export default function DraftReviewModal({ draftId, onClose, onChanged, onResolved }) {
    const [state, setState] = useState({ data: null, loading: true, error: null });
    const draft = state.data;

    // Per-row inline edit
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_EDIT);
    const [rowSaving, setRowSaving] = useState(false);
    const [rowError, setRowError] = useState(null);
    const [deletingRowId, setDeletingRowId] = useState(null);

    // Whole-draft actions
    const [confirm, setConfirm] = useState(null); // null | 'approve' | 'deleteDraft'
    const [actionBusy, setActionBusy] = useState(false);
    const [actionError, setActionError] = useState(null);

    // State is only set inside the async callbacks — keeps the initial fetch
    // out of "synchronous setState in an effect". Reloads after row edits reuse
    // this and simply refresh the data in place.
    const load = useCallback(() => {
        let cancelled = false;
        getDraftBatch(draftId)
            .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
            .catch((err) => {
                if (!cancelled) setState({
                    data: null, loading: false,
                    error: err.response?.data?.message || 'Failed to load draft.',
                });
            });
        return () => { cancelled = true; };
    }, [draftId]);

    useEffect(() => load(), [load]);

    const programs = draft?.programs ?? [];

    // --- per-row edit ---
    const startEdit = (p) => {
        setRowError(null);
        setEditingId(p.id);
        setEditForm({
            name: p.name ?? '',
            content: p.content ?? '',
            category: p.category ?? '',
            beginTime: toInputDateTime(p.beginTime),
            endTime: toInputDateTime(p.endTime),
        });
    };

    const cancelEdit = () => { setEditingId(null); setRowError(null); };

    const saveRow = async (id) => {
        const beginTime = fromInputDateTime(editForm.beginTime);
        const endTime = fromInputDateTime(editForm.endTime);
        if (endTime <= beginTime) {
            setRowError('End time must be after begin time.');
            return;
        }
        setRowSaving(true);
        setRowError(null);
        try {
            await updateProgram(id, {
                name: editForm.name.trim() || null,
                content: editForm.content.trim() || null,
                category: editForm.category || null,
                beginTime,
                endTime,
            });
            setEditingId(null);
            load();
            onChanged?.();
        } catch (err) {
            setRowError(err.response?.data?.message || 'Failed to save changes.');
        } finally {
            setRowSaving(false);
        }
    };

    const deleteRow = async (id) => {
        setDeletingRowId(id);
        setActionError(null);
        try {
            await deleteProgram(id);
            load();
            onChanged?.();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Failed to delete program.');
        } finally {
            setDeletingRowId(null);
        }
    };

    // --- whole-draft actions ---
    const doApprove = async () => {
        setActionBusy(true);
        setActionError(null);
        try {
            await approveDraftBatch(draftId);
            onResolved?.();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Failed to approve draft.');
            setActionBusy(false);
            setConfirm(null);
        }
    };

    const doDeleteDraft = async () => {
        setActionBusy(true);
        setActionError(null);
        try {
            await deleteDraftBatch(draftId);
            onResolved?.();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Failed to delete draft.');
            setActionBusy(false);
            setConfirm(null);
        }
    };

    const isProcessing = draft?.status === 'PROCESSING';

    return (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-start p-5 border-b border-gray-100 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-[#2C3325] flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-[#94A973]" />
                            Review AI Draft
                            {draft && <span className="font-mono text-sm text-gray-400">#{draft.id}</span>}
                        </h3>
                        {draft && (
                            <p className="text-sm text-[#6C755E] mt-1">
                                {draft.channelName || draft.channelId}
                                {draft.programDate && <> · {draft.programDate}</>}
                                {' · '}
                                <span className={`font-semibold ${isProcessing ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {draft.status}
                                </span>
                                {' · '}{programs.length} program{programs.length === 1 ? '' : 's'}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto">
                    {state.error && (
                        <div className="m-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {state.error}
                        </div>
                    )}
                    {actionError && (
                        <div className="m-4 flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
                        </div>
                    )}

                    {isProcessing && (
                        <div className="m-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                            This draft is still being generated. Reopen it in a moment to review the finished programs.
                        </div>
                    )}

                    {state.loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                        </div>
                    ) : programs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 text-sm">
                            This draft has no programs.
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[820px]">
                            <thead>
                                <tr className="bg-[#F4F5F0] border-b border-gray-200 text-xs font-bold text-[#6C755E] uppercase tracking-wide">
                                    <th className="p-3">Program</th>
                                    <th className="p-3 w-28">Category</th>
                                    <th className="p-3 w-40">Start</th>
                                    <th className="p-3 w-40">End</th>
                                    <th className="p-3 w-24 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {programs.map((p) => (
                                    editingId === p.id ? (
                                        <tr key={p.id} className="bg-[#FAFBF7] align-top">
                                            <td className="p-3" colSpan={5}>
                                                {rowError && (
                                                    <div className="mb-3 flex items-center gap-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {rowError}
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                    <div className="lg:col-span-2">
                                                        <label className="block text-xs font-bold text-[#6C755E] mb-1">Program Name</label>
                                                        <input
                                                            type="text" maxLength={500} value={editForm.name}
                                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-[#6C755E] mb-1">Category</label>
                                                        <select
                                                            value={editForm.category}
                                                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] bg-white text-sm"
                                                        >
                                                            <option value="">— None —</option>
                                                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-bold text-[#6C755E] mb-1">Start</label>
                                                            <input
                                                                type="datetime-local" step="1" value={editForm.beginTime}
                                                                onChange={(e) => setEditForm({ ...editForm, beginTime: e.target.value })}
                                                                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-[#6C755E] mb-1">End</label>
                                                            <input
                                                                type="datetime-local" step="1" value={editForm.endTime}
                                                                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                                                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="lg:col-span-2">
                                                        <label className="block text-xs font-bold text-[#6C755E] mb-1">Content</label>
                                                        <textarea
                                                            rows={2} maxLength={500} value={editForm.content}
                                                            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] text-sm resize-y"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2 mt-3">
                                                    <button
                                                        onClick={cancelEdit} disabled={rowSaving}
                                                        className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => saveRow(p.id)} disabled={rowSaving}
                                                        className="px-3 py-1.5 bg-[#94A973] text-white text-sm font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors disabled:opacity-60 flex items-center gap-1.5"
                                                    >
                                                        {rowSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                        Save
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr key={p.id} className="hover:bg-[#FAFAFA] transition-colors align-top">
                                            <td className="p-3">
                                                <p className="font-semibold text-[#2C3325]">{p.name || <span className="text-gray-300 italic">(no title)</span>}</p>
                                                {p.content && <p className="text-sm text-[#6C755E] line-clamp-2 max-w-md mt-0.5">{p.content}</p>}
                                            </td>
                                            <td className="p-3">
                                                {p.category && (
                                                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-md border ${categoryColor(p.category)}`}>
                                                        {p.category}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 font-bold text-[#4A533E] whitespace-nowrap text-sm">{formatFull(p.beginTime)}</td>
                                            <td className="p-3 text-[#6C755E] whitespace-nowrap text-sm">{formatFull(p.endTime)}</td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => startEdit(p)}
                                                    className="inline-flex p-1.5 text-[#94A973] hover:bg-[#F4F5F0] rounded-md transition-colors"
                                                    title="Edit program"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteRow(p.id)}
                                                    disabled={deletingRowId === p.id}
                                                    className="inline-flex p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-60"
                                                    title="Remove from draft"
                                                >
                                                    {deletingRowId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 p-4 shrink-0 bg-[#FAFAFA]">
                    {confirm === 'approve' && (
                        <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                            <p className="font-semibold mb-2">Approve this draft?</p>
                            <p className="mb-3">
                                The cleaned programs become the live schedule for this day — the channel's
                                existing programs for the same date are replaced. This can't be undone.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={() => setConfirm(null)} disabled={actionBusy}
                                    className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-white transition-colors disabled:opacity-60">
                                    Cancel
                                </button>
                                <button onClick={doApprove} disabled={actionBusy}
                                    className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center gap-1.5">
                                    {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Confirm approve
                                </button>
                            </div>
                        </div>
                    )}
                    {confirm === 'deleteDraft' && (
                        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
                            <p className="font-semibold mb-2">Delete this entire draft?</p>
                            <p className="mb-3">
                                All {programs.length} cleaned program{programs.length === 1 ? '' : 's'} in this draft are
                                permanently removed. The live schedule is left untouched. This can't be undone.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={() => setConfirm(null)} disabled={actionBusy}
                                    className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-white transition-colors disabled:opacity-60">
                                    Cancel
                                </button>
                                <button onClick={doDeleteDraft} disabled={actionBusy}
                                    className="px-3 py-1.5 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center gap-1.5">
                                    {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Confirm delete
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                            onClick={() => { setActionError(null); setConfirm('deleteDraft'); }}
                            disabled={actionBusy || confirm !== null}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" /> Delete Draft
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-white transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => { setActionError(null); setConfirm('approve'); }}
                                disabled={actionBusy || confirm !== null || programs.length === 0 || isProcessing}
                                title={isProcessing ? 'Wait for the draft to finish generating' : 'Approve and make this the live schedule'}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Approve
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}