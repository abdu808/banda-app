'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
    Package, Users, TrendingUp, CreditCard, ArrowLeft,
    Clock, LayoutGrid, CalendarCheck
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { STATUS_MAP } from '@/lib/constants';
import { formatArabicDate, calcPercent, formatNumber } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

interface Project {
    id: string;
    name: string;
    status: string;
    received_count?: number;
    total_count?: number;
}

export default function DistributorDashboardPage() {
    const router = useRouter();
    const [userName, setUserName] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    // 6 KPI مؤشرات
    const [kpis, setKpis] = useState({
        todayDeliveries: 0,       // 1 — تسليماتي اليوم
        totalDeliveries: 0,       // 2 — إجمالي تسليماتي
        totalCards: 0,            // 3 — بطاقاتي الموزعة
        assignedProjects: 0,      // 4 — المشاريع المسندة
        avgDailyRate: 0,          // 5 — متوسط صرفي اليومي
        lastDeliveryAt: '',       // 6 — آخر تسليم
    });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);

            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;

            // Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, email, allowed_projects')
                .eq('id', authUser.id)
                .single();

            setUserName(profile?.name || profile?.email || '');

            const allowedProjects = profile?.allowed_projects || [];

            // --- KPIs ---

            // All my deliveries
            const { data: myDeliveries } = await supabase
                .from('beneficiaries')
                .select('assigned_cards_count, received_at, project_id')
                .eq('status', 'received')
                .eq('distributed_by_id', authUser.id)
                .order('received_at', { ascending: false });

            const allDeliveries = myDeliveries || [];

            // 1 — تسليماتي اليوم
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayDeliveries = allDeliveries.filter(
                d => new Date(d.received_at) >= todayStart
            ).length;

            // 2 — إجمالي تسليماتي
            const totalDeliveries = allDeliveries.length;

            // 3 — بطاقاتي الموزعة
            const totalCards = allDeliveries.reduce(
                (sum, d) => sum + (d.assigned_cards_count || 0), 0
            );

            // 4 — المشاريع المسندة
            const assignedProjects = allowedProjects.length;

            // 5 — متوسط صرفي اليومي
            let avgDailyRate = 0;
            if (allDeliveries.length > 0) {
                const firstDate = new Date(allDeliveries[allDeliveries.length - 1].received_at);
                const diffDays = Math.max(1, Math.ceil(
                    (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
                ));
                avgDailyRate = Math.round(totalDeliveries / diffDays);
            }

            // 6 — آخر تسليم
            const lastDeliveryAt = allDeliveries.length > 0
                ? allDeliveries[0].received_at
                : '';

            setKpis({
                todayDeliveries,
                totalDeliveries,
                totalCards,
                assignedProjects,
                avgDailyRate,
                lastDeliveryAt,
            });

            // --- Projects (quick access cards) ---
            if (allowedProjects.length > 0) {
                const { data: projectsData } = await supabase
                    .from('projects')
                    .select('id, name, status')
                    .in('id', allowedProjects)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false });

                const withStats = await Promise.all((projectsData || []).map(async (proj) => {
                    const [{ count: total }, { count: received }] = await Promise.all([
                        supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
                        supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', proj.id).eq('status', 'received'),
                    ]);
                    return { ...proj, total_count: total ?? 0, received_count: received ?? 0 };
                }));

                setProjects(withStats);
            }
        } catch {
            toast.error('حدث خطأ في جلب البيانات');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    /* ---------- Loading ---------- */
    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="flex flex-col items-center gap-3">
                    <Spinner size="lg" className="text-blue-500" />
                    <p className="text-slate-400 text-sm">جاري التحميل…</p>
                </div>
            </div>
        );
    }

    /* ---------- UI ---------- */
    return (
        <div className="space-y-7">
            <Toaster position="top-center" />

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">
                    مرحباً{userName ? ` ${userName}` : ''}
                </h1>
                <p className="text-slate-500 mt-0.5 text-sm">مؤشرات أدائك في التسليم والتوزيع</p>
            </div>

            {/* — 6 KPI Cards — */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

                {/* 1 — تسليماتي اليوم */}
                <StatCard
                    variant="green"
                    icon={<CalendarCheck className="w-7 h-7" />}
                    label="تسليماتي اليوم"
                    value={formatNumber(kpis.todayDeliveries)}
                    sub="مستفيد تم تسليمه اليوم"
                />

                {/* 2 — إجمالي تسليماتي */}
                <StatCard
                    variant="blue"
                    icon={<Users className="w-7 h-7" />}
                    label="إجمالي تسليماتي"
                    value={formatNumber(kpis.totalDeliveries)}
                    sub="مستفيد منذ البداية"
                />

                {/* 3 — بطاقاتي الموزعة */}
                <StatCard
                    variant="purple"
                    icon={<CreditCard className="w-7 h-7" />}
                    label="بطاقاتي الموزعة"
                    value={formatNumber(kpis.totalCards)}
                    sub="بطاقة تم توزيعها"
                />

                {/* 4 — المشاريع المسندة */}
                <StatCard
                    variant="white"
                    icon={<LayoutGrid className="w-7 h-7 text-blue-600" />}
                    label="المشاريع المسندة"
                    value={formatNumber(kpis.assignedProjects)}
                    sub="مشروع مخصص لك"
                />

                {/* 5 — متوسط صرفي اليومي */}
                <StatCard
                    variant="white"
                    icon={<TrendingUp className="w-7 h-7 text-blue-600" />}
                    label="متوسط صرفي اليومي"
                    value={formatNumber(kpis.avgDailyRate)}
                    sub="مستفيد / يوم"
                />

                {/* 6 — آخر تسليم */}
                <StatCard
                    variant="amber"
                    icon={<Clock className="w-7 h-7" />}
                    label="آخر تسليم"
                    value={kpis.lastDeliveryAt
                        ? formatArabicDate(kpis.lastDeliveryAt)
                        : 'لا يوجد'}
                    sub={kpis.lastDeliveryAt ? 'آخر عملية قمت بها' : ''}
                />
            </div>

            {/* — المشاريع النشطة (وصول سريع) — */}
            {projects.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-4">ابدأ التسليم</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.map((project) => {
                            const pct = calcPercent(project.received_count ?? 0, project.total_count ?? 0);
                            return (
                                <button
                                    key={project.id}
                                    onClick={() => router.push(`/dashboard/handover/${project.id}`)}
                                    className="card p-4 text-right hover:shadow-md hover:border-emerald-200 transition-all group active:scale-[0.98]"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[14px] font-bold text-slate-800 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                                            {project.name}
                                        </span>
                                        <Package className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                    </div>
                                    <div className="progress-bar mb-1">
                                        <div
                                            className={`progress-fill ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>{formatNumber(project.received_count ?? 0)} / {formatNumber(project.total_count ?? 0)}</span>
                                        <span>{pct}%</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {projects.length === 0 && (
                <EmptyState
                    icon={<Package className="w-10 h-10" />}
                    title="لا توجد مشاريع نشطة"
                    description="لم يتم تخصيص مشاريع نشطة لك حالياً. تواصل مع الإدارة."
                />
            )}
        </div>
    );
}
