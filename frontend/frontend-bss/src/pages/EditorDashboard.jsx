import React, { useState } from 'react';
import {
    Menu, Search, ChevronDown, ChevronRight, LayoutDashboard,
    Settings, PenTool, X, CheckCircle, AlertCircle, Clock, Activity,
    LogOut, User                                                        // +LogOut, +User
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import useAuth from '../hooks/useAuth';

// --- MOCK DATA (unchanged) ---
const graphDataDay = Array.from({ length: 20 }, (_, i) => ({
    name: `CH ${i + 1}`,
    programs: Math.floor(Math.random() * 40) + 10,
}));

const graphDataWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        programs: Math.floor(Math.random() * 500) + 200,
    };
});

const channelStatusList = [
    { id: 1, name: 'VTV1 - National News', total: 42, status: 'Ready' },
    { id: 2, name: 'VTV3 - Entertainment', total: 38, status: 'Ready' },
    { id: 3, name: 'HTV7 - General', total: 0, status: 'Failed' },
    { id: 4, name: 'K+ Sport 1', total: 15, status: 'Ready' },
    { id: 5, name: 'HBO HD', total: 0, status: 'Failed' },
];

const rescheduleActivity = [
    { id: 1, time: '14:30', channel: 'VTV3', detail: 'Changed "Morning Show" to 08:00 AM', status: 'Changed' },
    { id: 2, time: '13:15', channel: 'K+ Sport', detail: 'Added "Live Premier League"', status: 'Added' },
    { id: 3, time: '11:00', channel: 'HBO HD', detail: 'Removed "Movie Repeat" slot', status: 'Removed' },
    { id: 4, time: '09:45', channel: 'VTV1', detail: 'Changed "News Flash" duration', status: 'Changed' },
];

export default function EditorDashboard() {
    const { user, logout } = useAuth(); // NEW

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState({ manage: false, tools: false });
    const [graphFilter, setGraphFilter] = useState('day');

    const toggleMenu = (menu) => {
        setExpandedMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'Ready':   return 'text-green-600 bg-green-100';
            case 'Failed':  return 'text-red-600 bg-red-100';
            case 'Added':   return 'text-blue-600 bg-blue-100';
            case 'Removed': return 'text-red-600 bg-red-100';
            case 'Changed': return 'text-yellow-600 bg-yellow-100';
            default:        return 'text-gray-600 bg-gray-100';
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">

            {/* SIDEBAR — unchanged */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} w-64 bg-[#E8EDDF] text-[#242423] shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col`}>
                <div className="p-4 flex justify-between items-center border-b border-gray-300">
                    <h2 className="text-xl font-bold">Menu</h2>
                    <button onClick={() => setIsSidebarOpen(false)}><X className="w-6 h-6" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#CFDBD5] font-medium text-left">
                        <LayoutDashboard className="w-5 h-5" /> Dashboard
                    </button>

                    <div>
                        <button
                            onClick={() => toggleMenu('manage')}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-[#CFDBD5] font-medium"
                        >
                            <div className="flex items-center gap-3"><Settings className="w-5 h-5" /> Manage</div>
                            {expandedMenus.manage ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {expandedMenus.manage && (
                            <div className="pl-11 pr-3 py-2 space-y-2 text-sm">
                                <p className="cursor-pointer hover:font-bold py-1">Channels</p>
                                <p className="cursor-pointer hover:font-bold py-1">Programs</p>
                                <p className="cursor-pointer hover:font-bold py-1">Sources</p>
                                <p className="cursor-pointer hover:font-bold py-1">Reschedule Logs</p>
                                <p className="cursor-pointer hover:font-bold py-1">Drafts by AI</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <button
                            onClick={() => toggleMenu('tools')}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-[#CFDBD5] font-medium"
                        >
                            <div className="flex items-center gap-3"><PenTool className="w-5 h-5" /> Tools</div>
                            {expandedMenus.tools ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {expandedMenus.tools && (
                            <div className="pl-11 pr-3 py-2 space-y-2 text-sm">
                                <p className="cursor-pointer hover:font-bold py-1">Export XLSX</p>
                                <p className="cursor-pointer hover:font-bold py-1">Import XLSX</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col w-full">


                <header className="bg-white h-16 shadow-sm flex items-center justify-between px-6 z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-gray-100 rounded-md hover:bg-gray-200">
                            <Menu className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold text-[#333533]">BSS Broadcast Scheduler System</h1>
                    </div>

                    {/* Right: search bar (unchanged) + user chip + logout */}
                    <div className="flex items-center gap-3">
                        {/* Search — same markup as before */}
                        <div className="relative w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-[#F5CB5C] text-sm outline-none"
                            />
                        </div>

                        {/* User chip — shows displayName from JWT / /me response */}
                        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                                <User className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                                    {user?.displayName || user?.username || 'Editor'}
                                </span>
                            </div>
                            <button
                                onClick={logout}
                                title="Sign out"
                                className="p-2 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Scrollable Dashboard Body — unchanged */}
                <main className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Top Graph Section */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-800">Schedule Completion</h2>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                {['day', 'week', 'month'].map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => setGraphFilter(filter)}
                                        className={`px-4 py-1 text-sm font-medium rounded-md capitalize ${graphFilter === filter ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={graphFilter === 'day' ? graphDataDay : graphDataWeek}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6B7280'}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6B7280'}} />
                                    <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Bar dataKey="programs" fill="#242423" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 4 Cards Section */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Schedules Ready</p>
                                <p className="text-2xl font-bold mt-1 text-gray-900">127</p>
                                <p className="text-sm text-green-600 mt-1 font-medium">92% Completed</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg"><CheckCircle className="w-6 h-6 text-green-600" /></div>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Crawl Failures</p>
                                <p className="text-2xl font-bold mt-1 text-gray-900">3</p>
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg"><AlertCircle className="w-6 h-6 text-red-600" /></div>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Pending Review</p>
                                <p className="text-2xl font-bold mt-1 text-gray-900">18</p>
                                <p className="text-sm text-yellow-600 mt-1 font-medium">AI drafts available</p>
                            </div>
                            <div className="p-3 bg-yellow-50 rounded-lg"><Clock className="w-6 h-6 text-yellow-600" /></div>
                        </div>

                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Reschedules Today</p>
                                <p className="text-2xl font-bold mt-1 text-gray-900">34</p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-lg"><Activity className="w-6 h-6 text-blue-600" /></div>
                        </div>
                    </div>

                    {/* Bottom Split Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col lg:flex-row">

                        {/* Left: Channels Schedule Status */}
                        <div className="flex-1 p-5 border-b lg:border-b-0 lg:border-r border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Channels Status</h3>
                            <div className="space-y-4">
                                {channelStatusList.map(ch => (
                                    <div key={ch.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                        <div>
                                            <p className="font-semibold text-gray-900">{ch.name}</p>
                                            <p className="text-xs text-gray-500">Total crawled: {ch.total}</p>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(ch.status)}`}>
                                            {ch.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Reschedule Activity */}
                        <div className="flex-1 p-5">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Reschedule Activity</h3>
                            <div className="space-y-4">
                                {rescheduleActivity.map(log => (
                                    <div key={log.id} className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                                        <p className="text-sm font-bold text-gray-400 mt-0.5 w-12 shrink-0">{log.time}</p>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900">{log.channel}</p>
                                            <p className="text-sm text-gray-600 mt-0.5">{log.detail}</p>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full shrink-0 ${getStatusColor(log.status)}`}>
                                            {log.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}