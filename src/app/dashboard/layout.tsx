'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, FileText, ShieldCheck, User2, Package, Users } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<{ email: string; role: string } | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, email')
                .eq('id', session.user.id)
                .single();

            const role = profile?.role ?? 'distributor';
            const email = profile?.email ?? session.user.email ?? '';

            setUser({ email, role });
            setLoading(false);

            // Distributors are not allowed to see the main dashboard (project management)
            // Redirect them to their allowed landing page: /dashboard/reports
            const isAdmin = role === 'admin' || session.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
            if (!isAdmin && (pathname === '/dashboard' || pathname === '/dashboard/')) {
                router.replace('/dashboard/reports');
            }
        };
        init();
    }, [router, pathname]);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        router.push('/login');
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center animate-pulse shadow-lg">
                        <span className="text-white font-black text-xl">ب</span>
                    </div>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
            </div>
        );
    }

    const isAdmin = user?.role === 'admin' || user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    const navLink = (href: string, label: string, Icon: any, exactMatch = false) => {
        const isActive = exactMatch ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
        return (
            <button
                onClick={() => router.push(href)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    }`}
            >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : ''}`} />
                <span className="hidden sm:block">{label}</span>
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50" dir="rtl">
            <nav className="glass sticky top-0 z-40 border-b border-white/60 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">

                        {/* Logo */}
                        <button
                            onClick={() => router.push(isAdmin ? '/dashboard' : '/dashboard/reports')}
                            className="flex-shrink-0 flex items-center gap-2.5 group"
                        >
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200 group-hover:shadow-blue-300 transition-shadow">
                                <span className="text-white font-black text-base">ب</span>
                            </div>
                            <span className="font-extrabold text-lg text-gray-900 hidden sm:block">نظام البطاقات</span>
                        </button>

                        {/* Nav Links — different per role */}
                        <div className="flex items-center gap-1">
                            {isAdmin ? (
                                <>
                                    {navLink('/dashboard', 'المشاريع', Package, true)}
                                    {navLink('/dashboard/reports', 'التقارير', FileText)}
                                    {navLink('/dashboard/admin/users', 'المستخدمون', Users)}
                                </>
                            ) : (
                                <>
                                    {navLink('/dashboard/reports', 'التقارير والتسليم', FileText)}
                                </>
                            )}
                        </div>

                        {/* User + Logout */}
                        <div className="flex items-center gap-2">
                            {user && (
                                <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 text-sm">
                                    {isAdmin ? (
                                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                                    ) : (
                                        <User2 className="w-4 h-4 text-gray-500" />
                                    )}
                                    <span className="text-gray-700 font-medium truncate max-w-[140px]">{user.email}</span>
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {isAdmin ? 'مدير' : 'موزع'}
                                    </span>
                                </div>
                            )}

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 text-red-500 hover:text-white hover:bg-red-500 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                                title="تسجيل الخروج"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:block">خروج</span>
                            </button>
                        </div>

                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
                {children}
            </main>
        </div>
    );
}
