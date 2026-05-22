import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import useAuth from '../hooks/useAuth';

const Unauthorized = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const goHome = () => {
        const destinations = {
            EDITOR: '/editor/dashboard',
            ADMIN:  '/admin/dashboard',
            USER:   '/user/home',
        };
        navigate(destinations[user?.role] || '/login', { replace: true });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] font-sans">
            <div className="text-center max-w-md px-6">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-red-50 rounded-full">
                        <ShieldOff className="w-10 h-10 text-red-400" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-[#2C3325] mb-2">Access Denied</h1>
                <p className="text-gray-500 text-sm mb-8">
                    You don't have permission to view this page.
                    {user && (
                        <span> You are signed in as <strong>{user.displayName}</strong> ({user.role}).</span>
                    )}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={goHome}
                        className="px-5 py-2.5 bg-[#94A973] hover:bg-[#8A9F6B] text-white font-semibold rounded-md transition-colors text-sm"
                    >
                        Go to my dashboard
                    </button>
                    <button
                        onClick={logout}
                        className="px-5 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-md transition-colors text-sm"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;