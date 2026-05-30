import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Menu, ChevronDown, ChevronRight, LayoutDashboard,
    Settings, PenTool, X, LogOut, User
} from 'lucide-react';
import useAuth from '../hooks/useAuth.js';

/**
 * Shared editor layout: sidebar (Manage + Tools menus) + header + main slot.
 *
 * Props:
 *   activeItem  — one of: 'dashboard' | 'channels' | 'programs' | 'sources'
 *                 | 'reschedule-logs' | 'drafts' | 'export-xlsx' | 'import-xlsx'
 *   breadcrumb  — JSX rendered in the header breadcrumb area
 *   headerRight — optional extra JSX to render before the user chip in the header
 *   children    — page body
 */
export default function EditorLayout({ activeItem, breadcrumb, headerRight, children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Auto-expand the menu group that contains the active item
    const initialExpansion = {
        manage: ['channels', 'programs', 'sources', 'reschedule-logs', 'drafts'].includes(activeItem),
        tools:  ['export-xlsx', 'import-xlsx'].includes(activeItem),
    };
    const [expandedMenus, setExpandedMenus] = useState(initialExpansion);
    const toggleMenu = (menu) => setExpandedMenus(prev => ({ ...prev, [menu]: !prev[menu] }));

    const subItemClass = (key) =>
        activeItem === key
            ? 'cursor-pointer text-[#2C3325] font-semibold bg-[#C3CEAA]/40 py-1.5 px-3 -ml-3 rounded-md'
            : 'cursor-pointer hover:text-[#2C3325] hover:font-semibold py-1.5 px-3 -ml-3 rounded-md transition-colors';

    return (
        <div className="flex h-screen bg-[#FAFAFA] font-sans overflow-hidden">

            {/* Mobile overlay */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* SIDEBAR */}
            <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static w-64 bg-[#E4E3CE] text-[#2C3325] shadow-2xl lg:shadow-none transition-transform duration-300 ease-in-out z-50 flex flex-col border-r border-[#D4D3BE]`}>
                <div className="p-5 flex justify-between items-center border-b border-[#D4D3BE]">
                    <h2 className="text-2xl font-bold text-[#4A533E] tracking-tight">BSS</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="hover:text-[#6C755E] transition-colors lg:hidden">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">

                    <button
                        onClick={() => navigate('/editor/dashboard')}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-[#4A533E] font-medium text-left transition-colors ${
                            activeItem === 'dashboard' ? 'bg-[#C3CEAA]/40 font-semibold' : 'hover:bg-[#C3CEAA]/30'
                        }`}
                    >
                        <LayoutDashboard className="w-5 h-5" /> Dashboard
                    </button>

                    {/* Manage */}
                    <div>
                        <button
                            onClick={() => toggleMenu('manage')}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-[#C3CEAA]/30 text-[#4A533E] font-medium transition-colors"
                        >
                            <div className="flex items-center gap-3"><Settings className="w-5 h-5" /> Manage</div>
                            {expandedMenus.manage ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {expandedMenus.manage && (
                            <div className="pl-11 pr-3 py-2 space-y-1 text-sm text-[#6C755E]">
                                <p onClick={() => navigate('/editor/channels')} className={subItemClass('channels')}>Channels</p>
                                <p onClick={() => navigate('/editor/programs')} className={subItemClass('programs')}>Programs</p>
                                <p onClick={() => navigate('/editor/sources')} className={subItemClass('sources')}>Sources</p>
                                <p onClick={() => navigate('/editor/reschedule-logs')} className={subItemClass('reschedule-logs')}>Reschedule Logs</p>
                                <p className={subItemClass('drafts')}>Drafts by AI</p>
                            </div>
                        )}
                    </div>

                    {/* Tools */}
                    <div>
                        <button
                            onClick={() => toggleMenu('tools')}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-[#C3CEAA]/30 text-[#4A533E] font-medium transition-colors"
                        >
                            <div className="flex items-center gap-3"><PenTool className="w-5 h-5" /> Tools</div>
                            {expandedMenus.tools ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {expandedMenus.tools && (
                            <div className="pl-11 pr-3 py-2 space-y-1 text-sm text-[#6C755E]">
                                <p className={subItemClass('export-xlsx')}>Export XLSX</p>
                                <p className={subItemClass('import-xlsx')}>Import XLSX</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MAIN COLUMN */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Header */}
                <header className="bg-white h-16 shadow-sm border-b border-gray-200 flex items-center justify-between px-6 z-10 shrink-0">
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-[#6C755E] hover:text-[#2C3325] bg-gray-50 rounded-md hover:bg-gray-100 transition-colors lg:hidden"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="hidden sm:flex items-center text-sm font-medium text-gray-500 truncate">
                            {breadcrumb}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                        {headerRight}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F4F5F0] rounded-full border border-[#E4E3CE]">
                            <User className="w-4 h-4 text-[#6C755E]" />
                            <span className="text-sm font-semibold text-[#4A533E] max-w-[120px] truncate">
                                {user?.displayName || user?.username || 'User'}
                            </span>
                        </div>
                        <button
                            onClick={logout}
                            title="Sign out"
                            className="p-2 rounded-md text-[#6C755E] hover:bg-red-50 hover:text-[#D54A4A] transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Page body slot */}
                <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
        </div>
    );
}