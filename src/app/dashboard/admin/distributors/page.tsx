'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, Users, TrendingUp, Award, RefreshCw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { formatArabicDate, formatNumber, getInitials, avatarColor, displayUsername } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, SkeletonList } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

interface Distributor {
    id: string;
    name: string;
    email: string;
}

interface DeliveryRecord {
    distributed_by_id: string | null;
    assigned_cards_count: number | null;
    received_at: string;
    project_id: string;
}

interface DistributorStat extends Distributor {
    total: number;
    totalCards: number;
    projects: number;
    today: number;
    lastAt: string;
}

export default function DistributorsPerformancePage() {
    const [stats, setStats] = useState<DistributorStat[]>([]);
    const [totalDeliveries, setTotalDeliveries] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [distRes, delivRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, name, email')
                    .eq('role', 'distributor')
                    .order('name'),
                supabase
                    .from('beneficiaries')
                    .select('distributed_by_id, assigned_cards_count, received_at, project_id')
                    .eq('status', 'received'),
            ]);

            if (distRes.error) throw distRes.error;
            if (delivRes.error) throw delivRes.error;

            const distributors: Distributor[] = distRes.data || [];
            const deliveries: DeliveryRecord[] = delivRes.data || [];

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const computed: DistributorStat[] = distributors
                .map(d => {
                    const mine = deliveries.filter(r => r.distributed_by_id === d.id);
                    return {
                        ...d,
                        total: mine.length,
                        totalCards: mine.reduce((s, r) => s + (r.assigned_cards_count ?? 0), 0),
                        projects: new Set(mine.map(r => r.project_id)).size,
                        today: mine.filter(r => new Date(r.received_at) >= todayStart).length,
                        lastAt: mine.reduce(
                            (lat, r) => (!lat || r.received_at > lat ? r.received_at : lat),
                            ''
                        ),
                    };
                })
                .sort((a, b) => b.total - a.total);

            setStats(computed);
            setTotalDeliveries(deliveries.length);
        } catch {
            toast.error('حدث خطأ في جلب بيانات الموزعين');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="space-y-6">
            <Toaster position="top-center" />

            <PageHeader
                title="أداء الموزعين"
                description="إحصائيات شاملة عن أداء كل موزع في التسليم"
                backHref="/dashboard/admin"
                icon={<BarChart3 className="w-5 h-5" />}
            />

            {/* Summary StatCards */}
            {!loading && stats.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        variant="blue"
                        icon={<Users className="w-6 h-6" />}
                        label="عدد الموزعين"
                        value={formatNumber(stats.length)}
                        sub="موزع مسجّل في النظام"
                    />
                    <StatCard
                        variant="green"
                        icon={<TrendingUp className="w-6 h-6" />}
                        label="إجمالي التسليمات"
                        value={formatNumber(totalDeliveries)}
                        sub="مستفيد تم تسليمه"
                    />
                    <StatCard
                        variant="white"
                        icon={<Award className="w-6 h-6 text-blue-600" />}
                        label="أكثر موزع نشاطاً"
                        value={stats[0]?.total > 0 ? (stats[0].name || displayUsername(stats[0].email)) : '—'}
                        sub={stats[0]?.total > 0 ? `${formatNumber(stats[0].total)} تسليم` : ''}
                    />
                </div>
            )}

            {/* Main Table Card */}
            <div className="card overflow-hidden">
                {/* Card Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 text-sm">
                        جميع الموزعين {!loading && `(${stats.length})`}
                    </h2>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                        title="تحديث"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="p-5">
                        <SkeletonList count={5} />
                    </div>
                ) : stats.length === 0 ? (
                    <div className="p-6">
                        <EmptyState
                            icon={<Users className="w-10 h-10" />}
                            title="لا يوجد موزعون"
                            description="أضف حسابات موزعين أولاً من صفحة إدارة المستخدمين"
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table min-w-full text-right">
                            <thead>
                                <tr>
                                    <th className="w-10 text-center">#</th>
                                    <th>الموزع</th>
                                    <th className="text-center">اليوم</th>
                                    <th>إجمالي التسليمات</th>
                                    <th className="text-center">بطاقات موزعة</th>
                                    <th className="text-center">مشاريع</th>
                                    <th>آخر نشاط</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.map((d, i) => {
                                    const initials = getInitials(d.name, d.email);
                                    const bg = avatarColor(d.email);
                                    const isTop = i === 0 && d.total > 0;

                                    return (
                                        <tr key={d.id}>
                                            {/* Rank */}
                                            <td className="text-center font-mono text-slate-400 text-sm">
                                                {i + 1}
                                            </td>

                                            {/* Name + Avatar */}
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 ${bg} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                                                            {d.name || 'بدون اسم'}
                                                            {isTop && (
                                                                <Badge variant="orange">الأول</Badge>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-slate-400 font-mono">{displayUsername(d.email)}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Today */}
                                            <td className="text-center">
                                                {d.today > 0 ? (
                                                    <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700">
                                                        {formatNumber(d.today)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-sm">—</span>
                                                )}
                                            </td>

                                            {/* Total Deliveries */}
                                            <td>
                                                <span className="font-bold text-slate-900 tabular-nums">
                                                    {formatNumber(d.total)}
                                                </span>
                                                {d.total === 0 && (
                                                    <span className="text-xs text-slate-400 mr-1.5">لا يوجد</span>
                                                )}
                                            </td>

                                            {/* Total Cards */}
                                            <td className="text-center tabular-nums">
                                                {d.totalCards > 0 ? (
                                                    <span className="text-slate-700">{formatNumber(d.totalCards)}</span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* Projects Count */}
                                            <td className="text-center">
                                                {d.projects > 0 ? (
                                                    <Badge variant="blue">{d.projects}</Badge>
                                                ) : (
                                                    <span className="text-slate-300 text-sm">—</span>
                                                )}
                                            </td>

                                            {/* Last Activity */}
                                            <td className="text-xs text-slate-500">
                                                {d.lastAt
                                                    ? formatArabicDate(d.lastAt)
                                                    : <span className="text-slate-300">لم يبدأ بعد</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {!loading && stats.length > 0 && (
                <p className="text-xs text-slate-400 text-center">
                    مرتبون حسب إجمالي التسليمات تنازلياً
                </p>
            )}
        </div>
    );
}
