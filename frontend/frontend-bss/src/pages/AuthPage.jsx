import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'; // +Loader2
import { useNavigate } from 'react-router-dom';                    // NEW
import useAuth from '../hooks/useAuth';                            // NEW

// ─── WHAT CHANGED FROM YOUR ORIGINAL ────────────────────────────────────────
// 1. Imports: added useNavigate, useAuth, Loader2
// 2. States:  error initial value '' (was hardcoded message), + isSubmitting
// 3. handleSubmit: replaced console.log stub with real API + navigation
// 4. Inputs:  added disabled={isSubmitting} + disabled:opacity-60 class
// 5. Button:  shows Loader2 spinner + "Signing in..." while submitting
// 6. Error banner: removed the `&& isLogin` condition so register errors show too
// UI, layout, all colours, all classNames — 100% unchanged.
// ────────────────────────────────────────────────────────────────────────────

const ROLE_DESTINATIONS = {
    EDITOR: '/editor/dashboard',
    ADMIN:  '/admin/dashboard',
    USER:   '/user/home',
};

const AuthPage = () => {
    const navigate            = useNavigate();      // NEW
    const { login, register } = useAuth();          // NEW

    const [isLogin, setIsLogin]           = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError]               = useState('');      // was hardcoded string
    const [isSubmitting, setIsSubmitting] = useState(false);   // NEW

    const [formData, setFormData] = useState({
        username:        '',
        email:           '',
        password:        '',
        confirmPassword: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError(''); // clear error as user types
    };

    // ── REPLACED console.log stub ─────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Client-side validation (register only)
        if (!isLogin) {
            if (formData.password !== formData.confirmPassword) {
                setError('Passwords do not match.');
                return;
            }
            if (formData.password.length < 8) {
                setError('Password must be at least 8 characters.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            let user;
            if (isLogin) {
                user = await login({
                    username: formData.username,
                    password: formData.password,
                });
            } else {
                user = await register({
                    username: formData.username,
                    email:    formData.email,
                    password: formData.password,
                });
            }
            // Navigate to the correct page based on role returned by backend
            navigate(ROLE_DESTINATIONS[user.role] || '/login', { replace: true });
        } catch (err) {
            // Shows backend's ErrorResponse.message, or a sensible fallback
            setError(
                err.response?.data?.message ||
                (isLogin
                    ? 'Invalid username or password. Please try again.'
                    : 'Registration failed. Please try again.')
            );
        } finally {
            setIsSubmitting(false);
        }
    };
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen flex font-sans text-gray-800 bg-[#FAFAFA]">

            {/* Left Panel - Branding (Hidden on small screens) */}
            <div className="hidden lg:flex lg:w-5/12 bg-[#E4E3CE] relative overflow-hidden flex-col justify-between p-12 border-r border-gray-200">
                {/* Abstract Background Shapes */}
                <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#C3CEAA] rounded-full mix-blend-multiply filter blur-sm opacity-60"></div>
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-[#EADDC2] rounded-full mix-blend-multiply filter blur-sm opacity-80 -translate-x-1/2"></div>
                <div className="absolute bottom-1/4 right-10 w-72 h-72 bg-[#A8B88F] rounded-full mix-blend-multiply filter blur-sm opacity-70"></div>
                <div className="absolute top-1/3 left-10 w-24 h-24 bg-[#C3CEAA] rotate-45 opacity-40"></div>
                <div className="absolute bottom-1/3 right-20 w-32 h-32 bg-[#A8B88F] rounded-xl rotate-12 opacity-40"></div>

                <div className="relative z-10">
                    <h1 className="text-4xl font-bold text-[#4A533E] tracking-tight">BSS</h1>
                </div>

                <div className="relative z-10">
                    <h2 className="text-2xl font-bold text-[#4A533E] mb-2 leading-tight">
                        Smarter scheduling,<br/>every broadcast day.
                    </h2>
                    <p className="text-sm text-[#6C755E]">v1.0 — TV360 Internal System</p>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="w-full lg:w-7/12 flex items-center justify-center p-8 sm:p-12 md:p-24 bg-[#FAFAFA]">
                <div className="w-full max-w-md">

                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-[#2C3325] mb-2">
                            {isLogin ? 'Welcome back' : 'Create an account'}
                        </h2>
                        <p className="text-gray-500 text-sm">
                            {isLogin ? 'Sign in to your BSS account' : 'Register for a new BSS access role'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Username Field */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[#6C755E] tracking-wide uppercase">
                                Username
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="Enter your username"
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#94A973] focus:border-transparent transition-colors disabled:opacity-60"
                                required
                            />
                        </div>

                        {/* Email Field (Register Only) */}
                        {!isLogin && (
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#6C755E] tracking-wide uppercase">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Enter your email address"
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#94A973] focus:border-transparent transition-colors disabled:opacity-60"
                                    required
                                />
                            </div>
                        )}

                        {/* Password Field */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-[#6C755E] tracking-wide uppercase">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Enter your password"
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#94A973] focus:border-transparent transition-colors disabled:opacity-60"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Field (Register Only) */}
                        {!isLogin && (
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#6C755E] tracking-wide uppercase">
                                    Confirm Password
                                </label>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Confirm your password"
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#94A973] focus:border-transparent transition-colors disabled:opacity-60"
                                    required
                                />
                            </div>
                        )}

                        {/* Forgot Password Link (Login Only) */}
                        {isLogin && (
                            <div className="flex justify-end">
                                <a href="#" className="text-sm text-[#8A9F6B] hover:text-[#6C755E] font-medium">
                                    Forgot password?
                                </a>
                            </div>
                        )}

                        {/* Error Message Banner — removed `&& isLogin` so register errors show too */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 mt-4 text-[#D54A4A] bg-[#FFF3F3] border border-[#F0BDBD] rounded-md text-sm">
                                <AlertCircle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 px-4 bg-[#94A973] hover:bg-[#8A9F6B] disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold rounded-md transition-colors mt-6 flex items-center justify-center gap-2"
                        >
                            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                            {isSubmitting
                                ? (isLogin ? 'Signing in...' : 'Creating account...')
                                : (isLogin ? 'Sign In' : 'Register Account')}
                        </button>
                    </form>

                    {/* Toggle Login/Register */}
                    <div className="mt-8 text-center">
                        <p className="text-sm text-gray-600">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <button
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                }}
                                disabled={isSubmitting}
                                className="text-[#8A9F6B] hover:underline font-medium disabled:opacity-60"
                            >
                                {isLogin ? 'Register here' : 'Sign in'}
                            </button>
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AuthPage;