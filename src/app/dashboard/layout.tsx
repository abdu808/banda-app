'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, FileText, Users, LayoutGrid, FolderOpen } from 'lucide-react';
import { getInitials, avatarColor, displayUsername } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

// المسارات المحمية — للمدير فقط
const ADMIN_ONLY_PATHS = ['/dashboard/admin', '/dashboard/project'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<{ email: string; role: string; name?: string } | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, email, name')
                .eq('id', session.user.id)
                .single();

            const role = profile?.role ?? 'distributor';
            const email = profile?.email ?? session.user.email ?? '';
            const name = profile?.name ?? '';

            // ===== حماية الصلاحيات =====
            // الموزع لا يدخل صفحات الأدمن (لوحة المؤشرات، المشاريع، إعدادات المشروع)
            if (role !== 'admin') {
                const isAdminArea =
                    pathname === '/dashboard' ||
                    pathname === '/dashboard/' ||
                    ADMIN_ONLY_PATHS.some(p => pathname.startsWith(p));

                if (isAdminArea) {
                    router.replace('/dashboard/distributor');
                    return; // يبقى spinner حتى تكتمل إعادة التوجيه
                }
            }

            setUser({ email, role, name });
            setLoading(false);
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
                <div className="flex flex-col items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-blue-200">
                        <span className="text-white font-black text-lg">ب</span>
                    </div>
                    <Spinner size="sm" className="text-blue-500" />
                </div>
            </div>
        );
    }

    const isAdmin = user?.role === 'admin';
    const displayName = user?.name || displayUsername(user?.email || '');
    const initials = getInitials(user?.name || '', user?.email);
    const bgColor = avatarColor(user?.email || '');

    const NavLink = ({ href, label, Icon, exact = false }: {
        href: string; label: string; Icon: React.ElementType; exact?: boolean;
    }) => {
        const isActive = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/');
        return (
            <button
                onClick={() => router.push(href)}
                className={`nav-link ${isActive ? 'active' : ''}`}
            >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:block">{label}</span>
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50" dir="rtl">

            {/* ===== شريط التنقل ===== */}
            <nav className="glass sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-14 items-center gap-4">

                        {/* الشعار — ينتقل للصفحة الرئيسية حسب الدور */}
                        <button
                            onClick={() => router.push(isAdmin ? '/dashboard' : '/dashboard/distributor')}
                            className="flex-shrink-0 flex items-center gap-2.5 group"
                        >
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[10px] flex items-center justify-center shadow-sm shadow-blue-200 group-hover:shadow-md transition-all">
                                <span className="text-white font-black text-sm">ب</span>
                            </div>
                            <span className="font-bold text-slate-800 hidden sm:block text-[15px] tracking-tight">
                                نظام البطاقات
                            </span>
                        </button>

                        {/* روابط التنقل */}
                        <div className="flex items-center gap-0.5">
                            {isAdmin ? (
                                <>
                                    {/* مدير: 4 روابط */}
                                    <NavLink href="/dashboard"             label="المؤشرات"    Icon={LayoutGrid} exact />
                                    <NavLink href="/dashboard/admin"       label="المشاريع"    Icon={FolderOpen} />
                                    <NavLink href="/dashboard/reports"     label="سجل الصرف"   Icon={FileText}   />
                                    <NavLink href="/dashboard/admin/users" label="المستخدمون"  Icon={Users}      />
                                </>
                            ) : (
                                <>
                                    {/* موزع: رابطان فقط */}
                                    <NavLink href="/dashboard/distributor" label="لوحتي"      Icon={LayoutGrid} />
                                    <NavLink href="/dashboard/reports"     label="سجل الصرف"  Icon={FileText}   />
                                </>
                            )}
                        </div>

                        {/* بيانات المستخدم + تسجيل الخروج */}
                        <div className="flex items-center gap-2.5">
                            {user && (
                                <div className="hidden sm:flex items-center gap-2">
                                    <div className={`w-7 h-7 ${bgColor} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                                        {initials}
                                    </div>
                                    <div className="hidden md:block">
                                        <p className="text-[13px] font-semibold text-slate-700 leading-none truncate max-w-[130px]">
                                            {displayName}
                                        </p>
                                        <p className={`text-[10px] font-medium mt-0.5 ${isAdmin ? 'text-blue-500' : 'text-slate-400'}`}>
                                            {isAdmin ? 'مدير النظام' : 'موزع'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="w-px h-5 bg-slate-200 hidden sm:block" />

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all"
                                title="تسجيل الخروج"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden sm:block text-xs">خروج</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* ===== المحتوى الرئيسي ===== */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 animate-fade-in">
                {children}
            </main>
        </div>
    );
}
