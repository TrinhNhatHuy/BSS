import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronRight, ArrowLeft, AlertCircle, Loader2, Clock, MonitorPlay,
    Edit2, Trash2, X, Save
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import {
    getProgramById, getProgramCategories, updateProgram, deleteProgram
} from '../api/programApi';

/** YYYYMMDDHHMMSS → "YYYY-MM-DD HH:MM:SS" */
function formatFull(s) {
    if (!s || s.length < 14) return '—';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/** YYYYMMDDHHMMSS → "YYYY-MM-DDTHH:MM:SS" for a datetime-local input. */
function toInputDateTime(s) {
    if (!s || s.length < 14) return '';
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
}

/** datetime-local value ("YYYY-MM-DDTHH:MM[:SS]") → 14-char YYYYMMDDHHMMSS. */
function fromInputDateTime(v) {
    if (!v) return '';
    const digits = v.replace(/[^0-9]/g, '');
    return digits.padEnd(14, '0').slice(0, 14);
}

/** Minutes between two YYYYMMDDHHMMSS values, as "45 min" / "1h 30m". */
function formatDuration(begin, end) {
    if (!begin || !end || begin.length < 12 || end.length < 12) return '—';
    const toDate = (s) => new Date(
        +s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8),
        +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14) || 0
    );
    const mins = Math.round((toDate(end) - toDate(begin)) / 60000);
    if (!mins || mins <= 0) return '—';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
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

function DetailItem({ label, children }) {
    return (
        <div>
            <p className="text-xs text-[#6C755E] font-medium uppercase tracking-wide mb-1">{label}</p>
            <div className="text-sm font-semibold text-[#2C3325]">{children}</div>
        </div>
    );
}

const EMPTY_EDIT = { name: '', content: '', category: '', beginTime: '', endTime: '' };

export default function ProgramDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [state, setState] = useState({ data: null, loading: true, error: null });
    const program = state.data;

    const [categories, setCategories] = useState([]);

    // Edit modal
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editForm, setEditForm] = useState(EMPTY_EDIT);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // Delete
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getProgramById(id)
            .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
            .catch(err => {
                if (!cancelled) setState({
                    data: null, loading: false,
                    error: err.response?.data?.message || 'Failed to load program.',
                });
            });
        return () => { cancelled = true; };
    }, [id]);

    useEffect(() => {
        getProgramCategories()
            .then(setCategories)
            .catch(() => setCategories(['SeriesVN', 'SeriesFR', 'Kids', 'Music', 'Sports', 'News', 'Others']));
    }, []);

    const openEdit = () => {
        if (!program) return;
        setEditForm({
            name: program.name ?? '',
            content: program.content ?? '',
            category: program.category ?? '',
            beginTime: toInputDateTime(program.beginTime),
            endTime: toInputDateTime(program.endTime),
        });
        setSaveError(null);
        setIsEditOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveError(null);

        const beginTime = fromInputDateTime(editForm.beginTime);
        const endTime = fromInputDateTime(editForm.endTime);

        if (endTime <= beginTime) {
            setSaveError('End time must be after begin time.');
            setSaving(false);
            return;
        }

        try {
            const updated = await updateProgram(id, {
                name: editForm.name.trim() || null,
                content: editForm.content.trim() || null,
                category: editForm.category || null,
                beginTime,
                endTime,
            });
            setState(prev => ({ ...prev, data: updated }));
            setIsEditOpen(false);
        } catch (err) {
            setSaveError(err.response?.data?.message || 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Delete this program permanently? This cannot be undone.`)) return;
        setDeleting(true);
        try {
            await deleteProgram(id);
            navigate('/editor/programs');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete program.');
            setDeleting(false);
        }
    };

    const breadcrumb = (
        <>
            <span>Manage</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span onClick={() => navigate('/editor/programs')} className="cursor-pointer hover:text-[#4A533E]">Programs</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">{program?.name || `#${id}`}</span>
        </>
    );

    return (
        <EditorLayout activeItem="programs" breadcrumb={breadcrumb}>
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-[#6C755E] transition-colors shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-2xl font-bold text-[#2C3325] flex items-center gap-2">
                            <MonitorPlay className="w-6 h-6 text-[#94A973]" />
                            Program Details
                        </h1>
                    </div>

                    {program && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={openEdit}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#94A973] hover:bg-[#8A9F6B] text-white font-medium rounded-lg transition-colors shadow-sm"
                            >
                                <Edit2 className="w-4 h-4" /> Edit
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-medium rounded-lg transition-colors shadow-sm disabled:opacity-60"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Delete
                            </button>
                        </div>
                    )}
                </div>

                {state.error && (
                    <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{state.error}</span>
                    </div>
                )}

                {state.loading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                    </div>
                ) : program ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-6">

                        {/* Title + category */}
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-5">
                            <div>
                                <h2 className="text-xl font-bold text-[#2C3325]">
                                    {program.name || <span className="text-gray-300 italic">(no title)</span>}
                                </h2>
                                <p className="text-sm text-[#6C755E] mt-1">
                                    {program.channelName || program.channelId || '—'}
                                    {program.channelName && (
                                        <span className="font-mono text-gray-400 ml-1">({program.channelId})</span>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {program.category && (
                                    <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-md border ${categoryColor(program.category)}`}>
                                        {program.category}
                                    </span>
                                )}
                                <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full border ${
                                    program.draftBatchId
                                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}>
                                    {program.draftBatchId ? 'Draft' : 'Live'}
                                </span>
                            </div>
                        </div>

                        {/* Fields */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
                            <DetailItem label="Program ID"><span className="font-mono">{program.id}</span></DetailItem>
                            <DetailItem label="Channel">{program.channelName || program.channelId || '—'}</DetailItem>
                            <DetailItem label="Category">{program.category || '—'}</DetailItem>
                            <DetailItem label="Duration">
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-[#94A973]" />
                                    {formatDuration(program.beginTime, program.endTime)}
                                </span>
                            </DetailItem>
                            <DetailItem label="Start Time">{formatFull(program.beginTime)}</DetailItem>
                            <DetailItem label="End Time">{formatFull(program.endTime)}</DetailItem>
                        </div>

                        {/* Content */}
                        <div className="pt-2">
                            <p className="text-xs text-[#6C755E] font-medium uppercase tracking-wide mb-2">Content</p>
                            {program.content ? (
                                <p className="text-sm text-[#2C3325] leading-relaxed bg-[#FAFAFA] border border-gray-100 rounded-lg p-4">
                                    {program.content}
                                </p>
                            ) : (
                                <span className="text-sm text-gray-300">—</span>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* EDIT MODAL */}
            {isEditOpen && program && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <h3 className="text-xl font-bold text-[#2C3325]">Edit Program</h3>
                            <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
                            {saveError && (
                                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {saveError}
                                </div>
                            )}

                            {/* Channel is shown read-only — not editable here */}
                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Channel</label>
                                <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600">
                                    {program.channelName || program.channelId || '—'}
                                    {program.channelName && <span className="font-mono text-gray-400 ml-1">({program.channelId})</span>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Program Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    placeholder="Program title"
                                    maxLength={500}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Category</label>
                                <select
                                    value={editForm.category}
                                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] bg-white"
                                >
                                    <option value="">— None —</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#6C755E] mb-1">
                                        Start Time <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        step="1"
                                        required
                                        value={editForm.beginTime}
                                        onChange={(e) => setEditForm({ ...editForm, beginTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#6C755E] mb-1">
                                        End Time <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        step="1"
                                        required
                                        value={editForm.endTime}
                                        onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Content</label>
                                <textarea
                                    value={editForm.content}
                                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                    placeholder="Episode / description"
                                    maxLength={500}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] resize-y"
                                />
                            </div>

                            <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </EditorLayout>
    );
}