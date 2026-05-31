import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, X, Edit2, Trash2, Plus, Eye,
    ChevronLeft, ChevronRight as ChevronRightIcon, Loader2, AlertCircle
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import { getChannels, createChannel, updateChannel, deleteChannel, getExportTypes } from '../api/channelApi';

const EMPTY_FORM = { id: '', name: '', channelGroupId: '', sources: '', exportIds: [] };
const PAGE_SIZE = 20;

function formatDateTime(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

function PageButton({ page, current, onClick }) {
    return (
        <button
            onClick={() => onClick(page)}
            className={`px-3 py-1 rounded font-medium text-sm ${
                page === current
                    ? 'bg-[#94A973] text-white'
                    : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
        >
            {page + 1}
        </button>
    );
}

/**
 * Editable list of export-ID rows (type + external id). Controlled: the parent
 * owns `rows` and receives the next array via `onChange`. One row per type — the
 * dropdown only offers types not already used by another row, since the backend
 * rejects duplicate types. Shared by the full channel modal and the per-row
 * quick-edit modal.
 */
function ExportIdsFields({ rows, exportTypes, onChange }) {
    const usedTypes = rows.map(r => r.type);
    const availableTypes = exportTypes.filter(t => !usedTypes.includes(t));

    const add = () => {
        if (availableTypes.length === 0) return;
        onChange([...rows, { type: availableTypes[0], externalId: '' }]);
    };
    const update = (i, field, value) =>
        onChange(rows.map((r, idx) => (i === idx ? { ...r, [field]: value } : r)));
    const remove = (i) => onChange(rows.filter((_, idx) => i !== idx));

    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-[#6C755E]">Export IDs</label>
                <button
                    type="button"
                    onClick={add}
                    disabled={availableTypes.length === 0}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#94A973] hover:text-[#4A533E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> Add
                </button>
            </div>

            {rows.length === 0 ? (
                <p className="text-xs text-gray-400">No export IDs. These are the channel&apos;s external broadcast IDs included in the XLSX export.</p>
            ) : (
                <div className="space-y-2">
                    {rows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <select
                                value={row.type}
                                onChange={(e) => update(i, 'type', e.target.value)}
                                className="px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] text-sm bg-white"
                            >
                                {/* current value + types not used by another row */}
                                {[row.type, ...availableTypes].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={row.externalId}
                                onChange={(e) => update(i, 'externalId', e.target.value)}
                                placeholder="External ID"
                                maxLength={100}
                                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] text-sm font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => remove(i)}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                title="Remove"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ManageChannels() {
    const navigate = useNavigate();

    // Data state
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [exportTypeFilter, setExportTypeFilter] = useState('');
    const [exportIdFilter, setExportIdFilter] = useState('');
    const [debouncedFilters, setDebouncedFilters] = useState({ search: '', exportType: '', exportId: '' });

    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);

    // Lookups
    const [exportTypes, setExportTypes] = useState([]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    // Per-row "edit export IDs" quick modal (opened from the Export IDs column)
    const [exportEdit, setExportEdit] = useState(null); // { channel, rows } | null
    const [exportSaving, setExportSaving] = useState(false);
    const [exportError, setExportError] = useState(null);

    // Load export types once for the filter dropdown
    useEffect(() => {
        getExportTypes().then(setExportTypes).catch(() => setExportTypes(['HD', 'SD', 'None']));
    }, []);

    // Debounce all text/dropdown filters together (400ms)
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedFilters({
                search: searchQuery,
                exportType: exportTypeFilter,
                exportId: exportIdFilter,
            });
            setCurrentPage(0);
        }, 400);
        return () => clearTimeout(t);
    }, [searchQuery, exportTypeFilter, exportIdFilter]);

    // Fetch channels
    useEffect(() => {
        let cancelled = false;
        const doFetch = async () => {
            setLoading(true);
            setFetchError(null);
            try {
                const data = await getChannels(debouncedFilters, currentPage, PAGE_SIZE);
                if (!cancelled) {
                    setChannels(data.content);
                    setTotalPages(data.totalPages);
                    setTotalElements(data.totalElements);
                }
            } catch (err) {
                if (!cancelled) setFetchError(err.response?.data?.message || 'Failed to load channels.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        doFetch();
        return () => { cancelled = true; };
    }, [debouncedFilters, currentPage, refreshKey]);

    const triggerRefresh = () => setRefreshKey(k => k + 1);

    const openAddModal = () => {
        setModalMode('add');
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setFormError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (channel) => {
        setModalMode('edit');
        setEditingId(channel.id);
        setFormData({
            id: channel.id,
            name: channel.name,
            channelGroupId: channel.channelGroupId ?? '',
            sources: channel.sources?.map(s => s.name).join(', ') ?? '',
            exportIds: channel.exportIds?.map(e => ({ type: e.type, externalId: e.externalId })) ?? [],
        });
        setFormError(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError(null);

        const sources = formData.sources
            ? formData.sources.split(',').map(s => s.trim()).filter(Boolean)
            : [];
        const channelGroupId = formData.channelGroupId !== '' ? Number(formData.channelGroupId) : null;
        // Drop rows with a blank external id; trim what's left.
        const exportIds = formData.exportIds
            .map(row => ({ type: row.type, externalId: row.externalId.trim() }))
            .filter(row => row.externalId);

        try {
            if (modalMode === 'add') {
                await createChannel({ id: formData.id, name: formData.name, channelGroupId, sources, exportIds });
            } else {
                await updateChannel(editingId, { name: formData.name, channelGroupId, sources, exportIds });
            }
            setIsModalOpen(false);
            triggerRefresh();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to save channel.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(`Delete channel "${id}"? This cannot be undone.`)) return;
        try {
            await deleteChannel(id);
            triggerRefresh();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete channel.');
        }
    };

    // --- Per-row export IDs quick edit ---
    const openExportEdit = (channel) => {
        setExportError(null);
        setExportEdit({
            channel,
            rows: channel.exportIds?.map(e => ({ type: e.type, externalId: e.externalId })) ?? [],
        });
    };

    const saveExportEdit = async () => {
        if (!exportEdit) return;
        setExportSaving(true);
        setExportError(null);

        const { channel, rows } = exportEdit;
        // PUT replaces the whole channel, so preserve its other fields and only
        // change exportIds. Drop blank rows and trim.
        const exportIds = rows
            .map(r => ({ type: r.type, externalId: r.externalId.trim() }))
            .filter(r => r.externalId);

        try {
            await updateChannel(channel.id, {
                name: channel.name,
                channelGroupId: channel.channelGroupId ?? null,
                sources: channel.sources?.map(s => s.name) ?? [],
                exportIds,
            });
            setExportEdit(null);
            triggerRefresh();
        } catch (err) {
            setExportError(err.response?.data?.message || 'Failed to save export IDs.');
        } finally {
            setExportSaving(false);
        }
    };

    const renderPageButtons = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => (
                <PageButton key={i} page={i} current={currentPage} onClick={setCurrentPage} />
            ));
        }
        const pages = new Set([0, totalPages - 1, currentPage]);
        for (let d = 1; d <= 2; d++) {
            if (currentPage - d >= 0) pages.add(currentPage - d);
            if (currentPage + d < totalPages) pages.add(currentPage + d);
        }
        const sorted = [...pages].sort((a, b) => a - b);
        const result = [];
        sorted.forEach((p, idx) => {
            if (idx > 0 && p - sorted[idx - 1] > 1) {
                result.push(<span key={`ellipsis-${p}`} className="px-1 text-gray-400">…</span>);
            }
            result.push(<PageButton key={p} page={p} current={currentPage} onClick={setCurrentPage} />);
        });
        return result;
    };

    const breadcrumb = (
        <>
            <span>Manage</span>
            <ChevronRightIcon className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">Channels</span>
        </>
    );

    return (
        <EditorLayout activeItem="channels" breadcrumb={breadcrumb}>
            <div className="p-6">

                {/* Top Actions */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <div className="relative w-full sm:w-72">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] focus:border-transparent outline-none transition-shadow shadow-sm"
                            />
                        </div>

                        {/* Export ID filters */}
                        <div className="flex gap-2 w-full sm:w-auto">
                            <select
                                value={exportTypeFilter}
                                onChange={(e) => setExportTypeFilter(e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] focus:border-transparent outline-none shadow-sm text-sm"
                                title="Filter by export type"
                            >
                                <option value="">Any type</option>
                                {exportTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input
                                type="text"
                                placeholder="Export ID…"
                                value={exportIdFilter}
                                onChange={(e) => setExportIdFilter(e.target.value)}
                                className="w-40 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] focus:border-transparent outline-none shadow-sm text-sm"
                            />
                        </div>
                    </div>

                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-[#94A973] hover:bg-[#8A9F6B] text-white font-medium rounded-lg transition-colors shadow-sm w-full lg:w-auto justify-center"
                    >
                        <Plus className="w-5 h-5" /> Add Channel
                    </button>
                </div>

                {/* Error banner */}
                {fetchError && (
                    <div className="mb-4 flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{fetchError}</span>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#F4F5F0] border-b border-gray-200 text-sm font-bold text-[#6C755E] uppercase tracking-wide">
                                    <th className="p-4">Channel ID</th>
                                    <th className="p-4">Channel Name</th>
                                    <th className="p-4 hidden md:table-cell">Group</th>
                                    <th className="p-4 hidden lg:table-cell">Export IDs</th>
                                    <th className="p-4">AI Status</th>
                                    <th className="p-4 hidden md:table-cell">Last Updated</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="p-12 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                                        </td>
                                    </tr>
                                ) : channels.length > 0 ? (
                                    channels.map(channel => (
                                        <tr key={channel.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <span className="font-mono text-sm text-[#2C3325]">{channel.id}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-semibold text-[#2C3325]">{channel.name}</span>
                                            </td>
                                            <td className="p-4 text-[#4A533E] text-sm hidden md:table-cell">
                                                {channel.channelGroupName ?? <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="p-4 text-sm hidden lg:table-cell">
                                                <div className="flex items-start gap-2">
                                                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                                                        {channel.exportIds?.length > 0 ? (
                                                            channel.exportIds.map(e => (
                                                                <span
                                                                    key={`${channel.id}-${e.type}`}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F4F5F0] border border-[#E4E3CE] rounded text-xs"
                                                                >
                                                                    <span className="font-bold text-[#4A533E]">{e.type}</span>
                                                                    <span className="font-mono text-gray-600">{e.externalId}</span>
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => openExportEdit(channel)}
                                                        className="p-1 text-[#94A973] hover:bg-[#F4F5F0] rounded transition-colors shrink-0"
                                                        title="Edit export IDs"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${
                                                    channel.aiUpdateStatus === 'UPDATED'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {channel.aiUpdateStatus === 'UPDATED' ? 'Updated' : 'Not Updated'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-500 hidden md:table-cell">
                                                {formatDateTime(channel.updateTime)}
                                            </td>
                                            <td className="p-4 text-right space-x-1">
                                                <button
                                                    onClick={() => navigate(`/editor/channels/${channel.id}`)}
                                                    className="p-1.5 text-[#94A973] hover:bg-[#F4F5F0] rounded transition-colors"
                                                    title="View details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(channel)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(channel.id)}
                                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-gray-400">
                                            {(debouncedFilters.search || debouncedFilters.exportType || debouncedFilters.exportId)
                                                ? 'No channels match the current filters.'
                                                : 'No channels yet. Click "Add Channel" to create one.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 bg-white">
                        <div>
                            {!loading && totalElements > 0 && `Showing ${channels.length} of ${totalElements} channels`}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                    disabled={currentPage === 0}
                                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {renderPageButtons()}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={currentPage >= totalPages - 1}
                                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronRightIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ADD / EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <h3 className="text-xl font-bold text-[#2C3325]">
                                {modalMode === 'add' ? 'Add New Channel' : `Edit: ${editingId}`}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
                            {formError && (
                                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {formError}
                                </div>
                            )}

                            {modalMode === 'add' && (
                                <div>
                                    <label className="block text-sm font-bold text-[#6C755E] mb-1">
                                        Channel ID <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.id}
                                        onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                                        placeholder="e.g., VTV1, ANGIANG1"
                                        pattern="^[A-Z0-9_]+$"
                                        title="Uppercase letters, digits, and underscores only"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973] font-mono"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Uppercase letters, digits, underscores. Cannot be changed later.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">
                                    Channel Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., VTV1 - National News"
                                    maxLength={50}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Channel Group ID</label>
                                <input
                                    type="number"
                                    value={formData.channelGroupId}
                                    onChange={(e) => setFormData({ ...formData, channelGroupId: e.target.value })}
                                    placeholder="Leave blank if no group"
                                    min="1"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Sources</label>
                                <input
                                    type="text"
                                    value={formData.sources}
                                    onChange={(e) => setFormData({ ...formData, sources: e.target.value })}
                                    placeholder="e.g., VTV Go, FPT Play"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#94A973]"
                                />
                                <p className="text-xs text-gray-400 mt-1">Comma-separated source names. Must exist in the system.</p>
                            </div>

                            {/* Export IDs — external broadcast IDs per type (HD/SD/...), used by the XLSX export */}
                            <ExportIdsFields
                                rows={formData.exportIds}
                                exportTypes={exportTypes}
                                onChange={(rows) => setFormData(prev => ({ ...prev, exportIds: rows }))}
                            />

                            <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QUICK-EDIT EXPORT IDS MODAL (opened from the Export IDs column) */}
            {exportEdit && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-xl font-bold text-[#2C3325] truncate">Export IDs</h3>
                                <p className="text-xs text-gray-400 truncate">
                                    {exportEdit.channel.name} <span className="font-mono">({exportEdit.channel.id})</span>
                                </p>
                            </div>
                            <button onClick={() => setExportEdit(null)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto">
                            {exportError && (
                                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {exportError}
                                </div>
                            )}

                            <ExportIdsFields
                                rows={exportEdit.rows}
                                exportTypes={exportTypes}
                                onChange={(rows) => setExportEdit(prev => ({ ...prev, rows }))}
                            />

                            <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setExportEdit(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={saveExportEdit}
                                    disabled={exportSaving}
                                    className="flex-1 px-4 py-2 bg-[#94A973] text-white font-medium rounded-lg hover:bg-[#8A9F6B] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {exportSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {exportSaving ? 'Saving…' : 'Save Export IDs'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </EditorLayout>
    );
}