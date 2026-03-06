'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { FileText, LayoutDashboard, ArrowLeft, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Project {
    id: string;
    name: string;
    status: string;
    created_at: string;
    received_count?: number;
    total_count?: number;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    active: { label: 'نشط', color: 'bg-green-100 text-green-700' },
    paused: { label: 'موقوف', color: 'bg-orange-100 text-orange-700' },
    completed: { label: 'مكتمل', color: 'bg-gray-100 text-gray-600' },
    closed: { label: 'مغلق', color: 'bg-red-100 text-red-600' },
};

export default function ReportsHubPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProjects = useCallback(async () => {
        try {
            setLoading(true);

            // Get current user profile to check role and allowed_projects
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase.from('profiles').select('role, allowed_projects').eq('id', user.id).single();

            const query = supabase.from('projects').select('id, name, status, created_at').order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;

            // Fetch per-project stats in parallel
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
        <div className="space-y-6">
            <Toaster position="top-center" />

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">مركز التقارير</h1>
                    <p className="text-gray-500 text-sm">سجلات التوزيع التفصيلية لكل مشروع</p>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => <div key={i} className="h-36 bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse" />)}
                </div>
            ) : projects.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <LayoutDashboard className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700">لا توجد مشاريع متاحة</h3>
                    <p className="mt-1 text-gray-400 text-sm">ليس لديك صلاحية الوصول لأي مشروع حتى الآن</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {projects.map((project) => {
                        const st = STATUS_MAP[project.status] ?? STATUS_MAP.completed;
                        const pct = (project.total_count ?? 0) > 0
                            ? Math.round(((project.received_count ?? 0) / (project.total_count ?? 1)) * 100) : 0;
                        const pending = (project.total_count ?? 0) - (project.received_count ?? 0);

                        return (
                            <div
                                key={project.id}
                                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 p-6 text-right flex flex-col justify-between group hover:border-blue-100"
                            >
                                <div>
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="text-base font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-blue-700 transition-colors" title={project.name}>
                                            {project.name}
                                        </h3>
                                        <span className={`flex-shrink-0 mr-2 text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                                            {st.label}
                                        </span>
                                    </div>

                                    {/* Stats row */}
                                    {(project.total_count ?? 0) > 0 && (
                                        <div className="flex gap-3 text-xs text-gray-500 mb-3">
                                            <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> {project.received_count} استلموا</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-orange-400" /> {pending} متبقي</span>
                                            <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-blue-500" /> {pct}%</span>
                                        </div>
                                    )}

                                    {/* Progress bar */}
                                    {(project.total_count ?? 0) > 0 && (
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'} transition-all duration-700`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 flex items-center gap-2">
                                    {project.status === 'active' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/dashboard/handover/${project.id}`);
                                            }}
                                            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-95 shadow-sm shadow-green-200"
                                        >
                                            بدء التسليم
                                        </button>
                                    )}
                                    <button
                                        onClick={() => router.push(`/dashboard/reports/${project.id}`)}
                                        className={`flex items-center justify-center gap-1.5 text-blue-600 text-sm font-semibold py-2.5 rounded-xl transition-all hover:bg-blue-50 px-3 ${project.status !== 'active' ? 'flex-1' : ''}`}
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
