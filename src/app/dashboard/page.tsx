'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
    Users, CreditCard, CheckCircle, Clock,
    TrendingUp, LayoutGrid, Package, ExternalLink
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { calcPercent, formatNumber } from '@/lib/utils';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface ProjectSummary {
    id: string;
    name: string;
    status: string;
    total: number;
    received: number;
    pending: number;
    pct: number;
    cards: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<{
        totalBeneficiaries: number;
        totalCards: number;
        delivered: number;
        pending: number;
        completionPct: number;
        avgDailyRate: number;
        activeProjects: number;
    } | null>(null);
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);

            // 1 — إجمالي المستفيدين
            const { count: totalBeneficiaries } = await supabase
                .from('beneficiaries')
                .select('*', { count: 'exact', head: true });

            // 2 — تم التسليم
            const { count: delivered } = await supabase
                .from('beneficiaries')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'received');

            // 3 — إجمالي البطاقات الموزعة
            const { data: cardsData } = await supabase
                .from('beneficiaries')
                .select('assigned_cards_count')
                .eq('status', 'received');

            const totalCards = (cardsData || []).reduce(
                (sum, row) => sum + (row.assigned_cards_count || 0), 0
            );

            // 4 — المشاريع النشطة
            const { count: activeProjects } = await supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active');

            // 5 — متوسط الصرف اليومي (عدد المسلّمين ÷ عدد أيام العمل)
            const { data: earliestRow } = await supabase
                .from('beneficiaries')
                .select('received_at')
                .eq('status', 'received')
                .order('received_at', { ascending: true })
                .limit(1);

            let avgDailyRate = 0;
            const deliveredCount = delivered || 0;

            if (earliestRow && earliestRow.length > 0 && deliveredCount > 0) {
                const firstDate = new Date(earliestRow[0].received_at);
                const now = new Date();
                const diffDays = Math.max(1, Math.ceil(
                    (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
                ));
                avgDailyRate = Math.round(deliveredCount / diffDays);
            }

            const total = totalBeneficiaries || 0;
            const pendingCount = total - deliveredCount;

            setStats({
                totalBeneficiaries: total,
                totalCards,
                delivered: deliveredCount,
                pending: pendingCount,
                completionPct: calcPercent(deliveredCount, total),
                avgDailyRate,
                activeProjects: activeProjects || 0,
            });

            // --- ملخص المشاريع (per-project breakdown) ---
            const { data: allProjects } = await supabase
                .from('projects')
                .select('id, name, status')
                .order('created_at', { ascending: false });

            if (allProjects && allProjects.length > 0) {
                const projectSummaries = await Promise.all(
                    allProjects.map(async (proj) => {
                        const [
                            { count: projTotal },
                            { count: projReceived },
                        ] = await Promise.all([
                            supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
                            supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', proj.id).eq('status', 'received'),
                        ]);

                        // عدد البطاقات الموزعة لهذا المشروع
                        const { data: projCards } = await supabase
                            .from('beneficiaries')
                            .select('assigned_cards_count')
                            .eq('project_id', proj.id)
                            .eq('status', 'received');

                        const cardsSum = (projCards || []).reduce(
                            (s: number, r: any) => s + (r.assigned_cards_count || 0), 0
                        );

                        const t = projTotal ?? 0;
                        const r = projReceived ?? 0;
                        return {
                            id: proj.id,
                            name: proj.name,
                            status: proj.status,
                            total: t,
                            received: r,
                            pending: t - r,
                            pct: calcPercent(r, t),
                            cards: cardsSum,
                        };
                    })
                );
                setProjects(projectSummaries);
            }
        } catch {
            toast.error('حدث خطأ في جلب الإحصائيات');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    /* ---------- Loading state ---------- */
    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="flex flex-col items-center gap-3">
                    <Spinner size="lg" className="text-blue-500" />
                    <p className="text-slate-400 text-sm">جاري تحميل المؤشرات…</p>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    /* ---------- helpers ---------- */
    const progressColor = (pct: number) =>
        pct === 100
            ? 'bg-emerald-500'
            : pct >= 70
                ? 'bg-blue-500'
                : pct >= 40
                    ? 'bg-amber-500'
                    : 'bg-red-400';

    /* ---------- UI ---------- */
    return (
        <div className="space-y-7">
            <Toaster position="top-center" />

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">لوحة المؤشرات</h1>
                <p className="text-slate-500 mt-0.5 text-sm">
                    مؤشرات الإنجاز الأساسية لتتبع مسار الصرف والتوزيع
                </p>
            </div>

            {/* — 6 KPI Cards — */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

                {/* 1 — إجمالي المستفيدين */}
                <StatCard
                    variant="blue"
                    icon={<Users className="w-7 h-7" />}
                    label="إجمالي المستفيدين"
                    value={formatNumber(stats.totalBeneficiaries)}
                    sub="مسجّل في النظام"
                />

                {/* 2 — تم التسليم */}
                <StatCard
                    variant="green"
                    icon={<CheckCircle className="w-7 h-7" />}
                    label="تم التسليم"
                    value={formatNumber(stats.delivered)}
                    sub={`من أصل ${formatNumber(stats.totalBeneficiaries)}`}
                />

                {/* 3 — المتبقي */}
                <StatCard
                    variant="amber"
                    icon={<Clock className="w-7 h-7" />}
                    label="المتبقي"
                    value={formatNumber(stats.pending)}
                    sub="في انتظار التسليم"
                />

                {/* 4 — نسبة الإنجاز */}
                <StatCard
                    variant="purple"
                    icon={<TrendingUp className="w-7 h-7" />}
                    label="نسبة الإنجاز"
                    value={`${stats.completionPct}%`}
                    progress={stats.completionPct}
                />

                {/* 5 — متوسط الصرف اليومي */}
                <StatCard
                    variant="white"
                    icon={<CreditCard className="w-7 h-7 text-blue-600" />}
                    label="متوسط الصرف اليومي"
                    value={formatNumber(stats.avgDailyRate)}
                    sub="مستفيد / يوم"
                />

                {/* 6 — المشاريع النشطة */}
                <StatCard
                    variant="white"
                    icon={<LayoutGrid className="w-7 h-7 text-blue-600" />}
                    label="المشاريع النشطة"
                    value={formatNumber(stats.activeProjects)}
                    sub="مشروع قيد التوزيع"
                />
            </div>

            {/* — شريط الإنجاز الكلي — */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-700">تقدّم الصرف الإجمالي</h2>
                    <span className="text-2xl font-black text-slate-900">{stats.completionPct}%</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${progressColor(stats.completionPct)}`}
                        style={{ width: `${stats.completionPct}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>{formatNumber(stats.delivered)} مسلّم</span>
                    <span>{formatNumber(stats.pending)} متبقي</span>
                </div>
            </div>

            {/* — ملخص المشاريع — */}
            {projects.length > 0 ? (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">ملخص المشاريع</h2>
                            <p className="text-slate-500 text-xs mt-0.5">تقدّم الصرف لكل مشروع على حدة</p>
                        </div>
                        <button
                            onClick={() => router.push('/dashboard/reports')}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 transition-colors"
                        >
                            عرض السجل الكامل
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {projects.map((proj) => (
                            <button
                                key={proj.id}
                                onClick={() => router.push(`/dashboard/reports/${proj.id}`)}
                                className="card p-5 text-right hover:shadow-md hover:border-blue-200 transition-all group active:scale-[0.99]"
                            >
                                {/* اسم المشروع + الحالة */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                                            <Package className="w-4.5 h-4.5 text-blue-600" />
                                        </div>
                                        <span className="text-[15px] font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                                            {proj.name}
                                        </span>
                                    </div>
                                    <StatusBadge status={proj.status} />
                                </div>

                                {/* شريط التقدم */}
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2.5">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${progressColor(proj.pct)}`}
                                        style={{ width: `${proj.pct}%` }}
                                    />
                                </div>

                                {/* الأرقام */}
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center">
                                        <div className="text-lg font-black text-slate-900 tabular-nums">{formatNumber(proj.total)}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">إجمالي</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black text-emerald-600 tabular-nums">{formatNumber(proj.received)}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">مسلّم</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black text-amber-600 tabular-nums">{formatNumber(proj.pending)}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">متبقي</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-black text-blue-600 tabular-nums">{proj.pct}%</div>
                                        <div className="text-[10px] text-slate-400 font-medium">الإنجاز</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <EmptyState
                    icon={<Package className="w-10 h-10" />}
                    title="لا توجد مشاريع"
                    description="لم يتم إنشاء أي مشاريع بعد في النظام."
                />
            )}
        </div>
    );
}
