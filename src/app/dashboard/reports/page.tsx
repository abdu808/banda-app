'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { FileText, Users, ArrowLeft, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { STATUS_MAP } from '@/lib/constants';
import { calcPercent, formatNumber } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState, SkeletonGrid } from '@/components/ui/EmptyState';

interface Project {
    id: string;
    name: string;
    status: string;
    created_at: string;
    received_count?: number;
    total_count?: number;
}

export default function ReportsHubPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('projects')
                .select('id, name, status, created_at')
                .order('created_at', { ascending: false });
            if (error) throw error;

            const withStats = await Promise.all((data || []).map(async (proj) => {
                const [{ count: total }, { count: received }] = await Promise.all([
                    supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
                    supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', proj.id).eq('status', 'received'),
                ]);
                return { ...proj, total_count: total ?? 0, received_count: received ?? 0 };
            }));

            setProjects(withStats);
        } catch {
            toast.error('حدث خطأ في جلب المشاريع');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    return (
        <div className="space-y-7">
            <Toaster position="top-center" />

            <div>
                <h1 className="text-2xl font-bold text-slate-900">سجل عمليات الصرف</h1>
                <p className="text-slate-500 mt-0.5 text-sm">سجلات توزيع المخصصات التفصيلية لكل مشروع</p>
            </div>

            {loading ? (
                <SkeletonGrid count={3} />
            ) : projects.length === 0 ? (
                <EmptyState
                    icon={<FileText className="w-10 h-10" />}
                    title="لا توجد مشاريع متاحة"
                    description="ليس لديك صلاحية الوصول لأي مشروع حتى الآن"
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {projects.map((project) => {
                        const pct = calcPercent(project.received_count ?? 0, project.total_count ?? 0);
                        const pending = (project.total_count ?? 0) - (project.received_count ?? 0);
                        const isActive = project.status === 'active';

                        return (
                            <div
                                key={project.id}
                                className="card p-5 flex flex-col justify-between group hover:shadow-md hover:border-blue-100 transition-all duration-200"
                            >
                                <div>
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="text-[15px] font-bold text-slate-800 line-clamp-2 leading-snug flex-1 ml-2 group-hover:text-blue-700 transition-colors" title={project.name}>
                                            {project.name}
                                        </h3>
                                        <StatusBadge status={project.status} />
                                    </div>

                                    {(project.total_count ?? 0) > 0 && (
                                        <>
                                            <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-3">
                                                <span className="flex items-center gap-1.5">
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                    {formatNumber(project.received_count ?? 0)} استلموا
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                                                    {formatNumber(pending)} متبقي
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                                                    {pct}%
                                                </span>
                                            </div>
                                            <div className="progress-bar">
                                                <div
                                                    className={`progress-fill ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="mt-4 flex items-center gap-2">
                                    {isActive && (
                                        <button
                                            onClick={() => router.push(`/dashboard/handover/${project.id}`)}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95"
                                        >
                                            <Users className="w-4 h-4" />
                                            بدء التسليم
                                        </button>
                                    )}
                                    <button
                                        onClick={() => router.push(`/dashboard/reports/${project.id}`)}
                                        className={`flex items-center justify-center gap-1.5 text-blue-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-50 px-3 transition-all ${!isActive ? 'flex-1' : ''}`}
                                    >
                                        <span>التقرير</span>
                                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
