import React, { useState } from 'react';
import { Search, CheckCircle, AlertCircle, Clock, Activity } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import EditorLayout from '../components/EditorLayout';

// --- MOCK DATA ---
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

const getStatusColor = (status) => {
    switch(status) {
        case 'Ready':   return 'text-emerald-700 bg-emerald-100';
        case 'Failed':  return 'text-rose-700 bg-rose-100';
        case 'Added':   return 'text-sky-700 bg-sky-100';
        case 'Removed': return 'text-rose-700 bg-rose-100';
        case 'Changed': return 'text-amber-700 bg-amber-100';
        default:        return 'text-gray-600 bg-gray-100';
    }
};

export default function EditorDashboard() {
    const [graphFilter, setGraphFilter] = useState('day');

    const breadcrumb = <span className="text-[#2C3325] font-bold">Editor Dashboard</span>;
    const headerRight = (
        <div className="relative hidden md:block w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                type="text"
                placeholder="Search schedules..."
                className="w-full pl-9 pr-4 py-2 bg-[#FAFAFA] border border-gray-200 rounded-full focus:ring-2 focus:ring-[#94A973] focus:border-transparent text-sm outline-none transition-all"
            />
        </div>
    );

    return (
        <EditorLayout activeItem="dashboard" breadcrumb={breadcrumb} headerRight={headerRight}>
            <div className="p-4 sm:p-6 space-y-6">

                {/* Graph Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-[#2C3325]">Schedule Completion</h2>
                            <p className="text-sm text-[#6C755E]">Overview of processed broadcast schedules</p>
                        </div>
                        <div className="flex bg-[#F4F5F0] rounded-lg p-1 border border-[#E4E3CE]">
                            {['day', 'week', 'month'].map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setGraphFilter(filter)}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${
                                        graphFilter === filter
                                            ? 'bg-white shadow-sm text-[#2C3325]'
                                            : 'text-[#6C755E] hover:text-[#4A533E]'
                                    }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={graphFilter === 'day' ? graphDataDay : graphDataWeek} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3CE" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6C755E'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6C755E'}} />
                                <Tooltip
                                    cursor={{fill: '#F4F5F0'}}
                                    contentStyle={{borderRadius: '8px', border: '1px solid #E4E3CE', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', color: '#2C3325'}}
                                />
                                <Bar dataKey="programs" fill="#94A973" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-bold text-[#6C755E] uppercase tracking-wide">Schedules Ready</p>
                            <p className="text-3xl font-extrabold mt-2 text-[#2C3325]">127</p>
                            <p className="text-sm text-emerald-600 mt-1 font-medium">92% Completed</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-bold text-[#6C755E] uppercase tracking-wide">Crawl Failures</p>
                            <p className="text-3xl font-extrabold mt-2 text-[#2C3325]">3</p>
                            <p className="text-sm text-rose-600 mt-1 font-medium">Needs attention</p>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-lg border border-rose-100"><AlertCircle className="w-6 h-6 text-rose-600" /></div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-bold text-[#6C755E] uppercase tracking-wide">Pending Review</p>
                            <p className="text-3xl font-extrabold mt-2 text-[#2C3325]">18</p>
                            <p className="text-sm text-amber-600 mt-1 font-medium">AI drafts available</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100"><Clock className="w-6 h-6 text-amber-600" /></div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow">
                        <div>
                            <p className="text-sm font-bold text-[#6C755E] uppercase tracking-wide">Reschedules</p>
                            <p className="text-3xl font-extrabold mt-2 text-[#2C3325]">34</p>
                            <p className="text-sm text-sky-600 mt-1 font-medium">Changes logged today</p>
                        </div>
                        <div className="p-3 bg-sky-50 rounded-lg border border-sky-100"><Activity className="w-6 h-6 text-sky-600" /></div>
                    </div>
                </div>

                {/* Bottom Split */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col lg:flex-row">

                    <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-gray-100">
                        <h3 className="text-lg font-bold text-[#2C3325] mb-5">Channels Status</h3>
                        <div className="space-y-3">
                            {channelStatusList.map(ch => (
                                <div key={ch.id} className="flex items-center justify-between p-3 bg-[#FAFAFA] border border-gray-100 hover:border-[#E4E3CE] rounded-lg transition-colors">
                                    <div>
                                        <p className="font-semibold text-[#2C3325]">{ch.name}</p>
                                        <p className="text-xs text-[#6C755E] mt-0.5">Total crawled: {ch.total}</p>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(ch.status)}`}>
                                        {ch.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 p-6">
                        <h3 className="text-lg font-bold text-[#2C3325] mb-5">Recent Reschedules</h3>
                        <div className="space-y-3">
                            {rescheduleActivity.map(log => (
                                <div key={log.id} className="flex items-start gap-4 p-3 bg-[#FAFAFA] border border-gray-100 hover:border-[#E4E3CE] rounded-lg transition-colors">
                                    <p className="text-sm font-bold text-[#94A973] mt-0.5 w-12 shrink-0">{log.time}</p>
                                    <div className="flex-1">
                                        <p className="font-semibold text-[#2C3325]">{log.channel}</p>
                                        <p className="text-sm text-[#6C755E] mt-0.5">{log.detail}</p>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full shrink-0 ${getStatusColor(log.status)}`}>
                                        {log.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </EditorLayout>
    );
}