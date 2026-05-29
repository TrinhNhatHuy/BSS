import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, X, Edit2, Trash2, Plus,
    Link as LinkIcon, ExternalLink, Loader2, AlertCircle, ChevronRight
} from 'lucide-react';
import EditorLayout from '../components/EditorLayout';
import {
    getChannelSources, createChannelSource,
    updateChannelSource, deleteChannelSource,
} from '../api/sourceApi';
import { getChannels } from '../api/channelApi';

const EMPTY_FORM = {
    channelId: '',
    sourceName: '',
    url: '',
    priority: 1,
    status: true,
};

export default function ManageSources() {
    // Data
    const [rows, setRows] = useState([]);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [originalKey, setOriginalKey] = useState(null); // { channelId, sourceName } when editing
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const [refreshKey, setRefreshKey] = useState(0);
    const triggerRefresh = () => setRefreshKey(k => k + 1);

    // Load channel list for the dropdown (page through all of them)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Pull a generous page; most BSS instances have well under 200 channels
                const data = await getChannels({}, 0, 500);
                if (!cancelled) setChannels(data.content ?? []);
            } catch {
                if (!cancelled) setChannels([]);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Load (channel, source) rows
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setFetchError(null);
            try {
                const data = await getChannelSources();
                if (!cancelled) setRows(data);
            } catch (err) {
                if (!cancelled) setFetchError(err.response?.data?.message || 'Failed to load sources.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [refreshKey]);

    const filteredRows = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r =>
            (r.channelId ?? '').toLowerCase().includes(q) ||
            (r.channelName ?? '').toLowerCase().includes(q) ||
            (r.sourceName ?? '').toLowerCase().includes(q) ||
            (r.url ?? '').toLowerCase().includes(q)
        );
    }, [rows, searchQuery]);

    const openAddModal = () => {
        setModalMode('add');
        setOriginalKey(null);
        setFormData({
            ...EMPTY_FORM,
            channelId: channels[0]?.id ?? '',
        });
        setFormError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (row) => {
        setModalMode('edit');
        setOriginalKey({ channelId: row.channelId, sourceName: row.sourceName });
        setFormData({
            channelId: row.channelId,
            sourceName: row.sourceName,
            url: row.url ?? '',
            priority: row.priority ?? 1,
            status: row.status ?? true,
        });
        setFormError(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFormError(null);

        try {
            if (modalMode === 'add') {
                await createChannelSource({
                    channelId: formData.channelId,
                    sourceName: formData.sourceName.trim(),
                    url: formData.url.trim() || null,
                    priority: formData.priority,
                    status: formData.status,
                });
            } else {
                await updateChannelSource(originalKey.channelId, originalKey.sourceName, {
                    url: formData.url.trim() || null,
                    priority: formData.priority,
                    status: formData.status,
                });
            }
            setIsModalOpen(false);
            triggerRefresh();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to save source.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Unlink source "${row.sourceName}" from channel "${row.channelId}"?`)) return;
        try {
            await deleteChannelSource(row.channelId, row.sourceName);
            triggerRefresh();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to remove source.');
        }
    };

    const statusBadge = (status) =>
        status
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'bg-rose-100 text-rose-700 border-rose-200';

    const breadcrumb = (
        <>
            <span>Manage</span>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="text-[#2C3325] font-bold">Data Sources</span>
        </>
    );

    return (
        <EditorLayout activeItem="sources" breadcrumb={breadcrumb}>
            <div className="p-6">

                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search channels, sources, or URLs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none transition-shadow shadow-sm"
                        />
                    </div>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-[#94A973] hover:bg-[#8A9F6B] text-white font-medium rounded-lg transition-colors shadow-sm w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-5 h-5" />
                        Add Source URL
                    </button>
                </div>

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
                                <th className="p-4 w-40">Channel</th>
                                <th className="p-4 w-56">Source Name</th>
                                <th className="p-4">Target URL</th>
                                <th className="p-4 w-24 text-center">Priority</th>
                                <th className="p-4 w-28 text-center">Status</th>
                                <th className="p-4 w-28 text-right">Actions</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#94A973]" />
                                    </td>
                                </tr>
                            ) : filteredRows.length > 0 ? (
                                filteredRows.map(row => (
                                    <tr key={`${row.channelId}::${row.sourceName}`} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <p className="font-bold text-[#2C3325]">{row.channelName ?? row.channelId}</p>
                                            <p className="text-xs text-gray-400 font-mono mt-0.5">{row.channelId}</p>
                                        </td>
                                        <td className="p-4 text-[#4A533E] font-medium">{row.sourceName}</td>
                                        <td className="p-4">
                                            {row.url ? (
                                                <div className="flex items-center gap-2 max-w-md">
                                                    <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                                    <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate text-sm">
                                                        {row.url}
                                                    </a>
                                                    <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-sm">—</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                                row.priority === 1 ? 'bg-[#94A973] text-white' : 'bg-gray-200 text-gray-700'
                                            }`}>
                                                {row.priority ?? '—'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-md border ${statusBadge(row.status)}`}>
                                                {row.status ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-1">
                                            <button
                                                onClick={() => openEditModal(row)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit"
                                            ><Edit2 className="w-4 h-4" /></button>
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Remove from channel"
                                            ><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">
                                    {searchQuery ? 'No sources match your search.' : 'No sources yet. Click "Add Source URL" to add one.'}
                                </td></tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ADD / EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">

                        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-[#FAFAFA]">
                            <h3 className="text-lg font-bold text-[#2C3325]">
                                {modalMode === 'add' ? 'Add New Data Source' : 'Edit Source Configuration'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {formError && (
                                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {formError}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#6C755E] mb-1">Target Channel</label>
                                    <select
                                        value={formData.channelId}
                                        onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                                        disabled={modalMode === 'edit'}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none bg-white disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                        {channels.length === 0 && <option value="">No channels available</option>}
                                        {channels.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#6C755E] mb-1">Status</label>
                                    <select
                                        value={formData.status ? 'true' : 'false'}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value === 'true' })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none bg-white"
                                    >
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Source Identifier (Name)</label>
                                <input
                                    type="text" required value={formData.sourceName}
                                    onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })}
                                    placeholder="e.g., VTV Go Web"
                                    maxLength={50}
                                    disabled={modalMode === 'edit'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none disabled:bg-gray-100 disabled:text-gray-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Crawl URL</label>
                                <input
                                    type="url" value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                    placeholder="https://..."
                                    maxLength={500}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none text-blue-600"
                                />
                                <p className="text-xs text-gray-500 mt-1">n8n will use this exact URL to fetch the schedule data.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#6C755E] mb-1">Crawl Priority (Fallback Order)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number" min="1" max="10" required value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) })}
                                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94A973] outline-none"
                                    />
                                    <span className="text-sm text-gray-500">Lower number = higher priority (1 is primary)</span>
                                </div>
                                <p className="text-xs text-amber-600 mt-1">
                                    Note: priority/URL/status are properties of the source itself — changes apply to every channel that uses this source.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                                <button
                                    type="button" onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-[#94A973] text-white font-bold rounded-lg hover:bg-[#8A9F6B] transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Saving…' : 'Save Source'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </EditorLayout>
    );
}

