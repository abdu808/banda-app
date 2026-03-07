'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, User, LogIn, Eye, EyeOff } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { normalizeEmail } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const resolvedEmail = normalizeEmail(email);
        const { error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });
        if (error) {
            toast.error('خطأ في اسم المستخدم أو كلمة المرور');
            setLoading(false);
        } else {
            toast.success('تم تسجيل الدخول بنجاح');
            window.location.href = '/dashboard';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl"
            style={{ background: 'linear-gradient(135deg, #0c1526 0%, #0f2044 40%, #1a3a6b 70%, #0c1526 100%)' }}>
            <Toaster position="top-center" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="absolute inset-0 opacity-[0.025]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
            </div>
            <div className="relative w-full max-w-[390px] animate-slide-up">
                <div className="relative bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
                    <div className="px-8 pt-9 pb-6 text-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                            <span className="text-white font-black text-2xl">ب</span>
                        </div>
                        <h1 className="text-xl font-bold text-white mb-1 tracking-tight">نظام البطاقات</h1>
                        <p className="text-slate-400 text-sm">أدخل بياناتك للوصول إلى لوحة التحكم</p>
                    </div>
                    <div className="mx-8 h-px bg-white/5" />
                    <form onSubmit={handleLogin} className="px-8 py-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">اسم المستخدم</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                                    <User className="h-4 w-4 text-slate-500" />
                                </div>
                                <input type="text" required autoFocus placeholder="ahmad123 أو ahmad@banda.app"
                                    value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr"
                                    className="block w-full pl-4 pr-10 py-2.5 bg-white/8 border border-white/10 text-white placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 focus:bg-white/10 transition-all" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">كلمة المرور</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-slate-500" />
                                </div>
                                <input type={showPassword ? 'text' : 'password'} required placeholder="••••••••"
                                    value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr"
                                    className="block w-full pl-11 pr-10 py-2.5 bg-white/8 border border-white/10 text-white placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 focus:bg-white/10 transition-all" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors">
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="pt-1">
                            <button type="submit" disabled={loading}
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]">
                                {loading ? <Spinner size="sm" className="text-white/80" /> : <><LogIn className="w-4 h-4" />تسجيل الدخول</>}
                            </button>
                        </div>
                    </form>
                </div>
                <p className="text-center text-slate-600 text-xs mt-5">نظام إدارة توزيع المخصصات والبطاقات</p>
            </div>
        </div>
    );
}
