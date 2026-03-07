'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { FolderPlus, Settings, Users, TrendingUp, CheckCircle, Search, LayoutGrid, BarChart3 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { STATUS_MAP, DEFAULT_CARDS_PER_BENEFICIARY } from '@/lib/constants';
import { formatArabicDate, calcPercent, formatNumber } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, SkeletonGrid } from '@/components/ui/EmptyState';

interface Project {
    id: string;
    name: string;
    status: string;
    created_at: string;
    requires_cards: boolean;
    received_count?: number;
    total_count?: number;
}

export default function AdminDashboardPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [globalStats, setGlobalStats] = useState({ totalBeneficiaries: 0, totalReceived: 0, activeProjects: 0 });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Create project modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [requiresCards, setRequiresCards] = useState(true);
    const [cardsCount, setCardsCount] = useState(DEFAULT_CARDS_PER_BENEFICIARY);
    const [isPublic, setIsPublic] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const fetchProjectData = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, status, created_at, requires_cards')
                .order('created_at', { ascending: false });
            if (error) throw error;

            const projectsWithStats = await Promise.all((data || []).map(async (proj) => {
                const [{ count: total }, { count: received }] = await Promise.all([
                    supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
                    supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', proj.id).eq('status', 'received'),
                ]);
                return { ...proj, total_count: total ?? 0, received_count: received ?? 0 };
            }));

            setProjects(projectsWithStats);
            const totalBeni = projectsWithStats.reduce((s, p) => s + (p.total_count ?? 0), 0);
            const totalRec = projectsWithStats.reduce((s, p) => s + (p.received_count ?? 0), 0);
            setGlobalStats({
                totalBeneficiaries: totalBeni,
                totalReceived: totalRec,
                activeProjects: projectsWithStats.filter(p => p.status === 'active').length,
            });
        } catch {
            toast.error('حدث خطأ في جلب المشاريع');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProjectData();
    }, [fetchProjectData]);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        setIsCreating(true);
        try {
            const { data, error } = await supabase.from('projects').insert([{
                name: newProjectName.trim(),
                requires_cards: requiresCards,
                cards_per_beneficiary: cardsCount,
                is_public: isPublic,
                passcode: passcode.trim() || null
            }]).select().single();
            if (error) throw error;
            toast.success('تم إنشاء المشروع بنجاح');
            setProjects([{ ...data, total_count: 0, received_count: 0 }, ...projects]);
            setNewProjectName(''); setRequiresCards(true); setCardsCount(DEFAULT_CARDS_PER_BENEFICIARY);
            setIsPublic(false); setPasscode('');
            setShowCreateModal(false);
        } catch (error: any) {
            toast.error(error.message || 'خطأ في الإنشاء');
        } finally {
            setIsCreating(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const globalPct = calcPercent(globalStats.totalReceived, globalStats.totalBeneficiaries);

    return (
        <div className="space-y-7">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">لوحة التحكم — الإدارة</h1>
                    <p className="text-slate-500 mt-0.5 text-sm">إدارة المشاريع والموارد والتوزيع الكامل</p>
                </div>
                <Button variant="primary" icon={<FolderPlus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
                    مشروع جديد
                </Button>
            </div>

            {/* Global Stats */}
            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        variant="blue"
                        icon={<Users className="w-6 h-6" />}
                        label="إجمالي المستفيدين"
                        value={formatNumber(globalStats.totalBeneficiaries)}
                        sub={`${formatNumber(globalStats.totalReceived)} استلموا`}
                    />
                    <StatCard
                        variant="green"
                        icon={<TrendingUp className="w-6 h-6" />}
                        label="نسبة الإنجاز الكلية"
                        value={`${globalPct}%`}
                        progress={globalPct}
                    />
                    <StatCard
                        variant="white"
                        icon={<CheckCircle className="w-6 h-6 text-blue-600" />}
                        label="المشاريع النشطة"
                        value={formatNumber(globalStats.activeProjects)}
                    />
                </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="secondary" icon={<Users className="w-4 h-4" />} onClick={() => router.push('/dashboard/admin/users')}>
                    إدارة المستخدمين
                </Button>
                <Button variant="secondary" icon={<LayoutGrid className="w-4 h-4" />} onClick={() => router.push('/dashboard/reports')}>
                    التقارير
                </Button>
                <Button variant="secondary" icon={<BarChart3 className="w-4 h-4" />} onClick={() => router.push('/dashboard/admin/distributors')}>
                    أداء الموزعين
                </Button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="h-5 w-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="ابحث عن مشروع..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="input-field pr-10 py-3"
                />
            </div>

            {/* Projects Grid */}
            {loading ? (
                <SkeletonGrid count={3} />
            ) : filteredProjects.length === 0 ? (
                <EmptyState
                    icon={<LayoutGrid className="w-10 h-10" />}
                    title={searchQuery ? 'لم يتم العثور على مشاريع' : 'لا توجد مشاريع حالياً'}
                    description={searchQuery ? 'جرب كلمات بحث أخرى' : 'أنشئ أول مشروع للبدء في توزيع المخصصات'}
                    action={!searchQuery ? (
                        <Button variant="primary" icon={<FolderPlus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
                            إنشاء مشروع
                        </Button>
                    ) : undefined}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredProjects.map((project) => {
                        const pct = calcPercent(project.received_count ?? 0, project.total_count ?? 0);
                        const isActive = project.status === 'active';
                        return (
                            <div key={project.id} className="card flex flex-col group hover:shadow-md transition-all duration-200">
                                <div className="p-5 flex-grow">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-[15px] font-bold text-slate-800 line-clamp-2 leading-snug flex-1 ml-2" title={project.name}>
                                            {project.name}
                                        </h3>
                                        <StatusBadge status={project.status} />
                                    </div>

                                    {(project.total_count ?? 0) > 0 && (
                                        <div className="mb-3">
                                            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                                <span>الإنجاز</span>
                                                <span className="font-semibold text-slate-700">
                                                    {formatNumber(project.received_count ?? 0)} / {formatNumber(project.total_count ?? 0)}
                                                </span>
                                            </div>
                                            <div className="progress-bar">
                                                <div
                                                    className={`progress-fill ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <div className="text-left text-xs text-slate-400 mt-1">{pct}%</div>
                                        </div>
                                    )}

                                    <p className="text-xs text-slate-400">{formatArabicDate(project.created_at)}</p>
                                </div>

                                <div className="bg-slate-50/80 px-5 py-3.5 border-t border-slate-100 flex gap-2 rounded-b-[16px]">
                                    <button
                                        onClick={() => { if (isActive) router.push(`/dashboard/handover/${project.id}`); }}
                                        disabled={!isActive}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                            isActive
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95'
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <Users className="w-4 h-4" />
                                        {isActive ? 'بدء التسليم' : (STATUS_MAP[project.status]?.label ?? 'غير متاح')}
                                    </button>
                                    <button
                                        onClick={() => router.push(`/dashboard/project/${project.id}`)}
                                        className="bg-white text-slate-600 border border-slate-200 p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
                                        title="إدارة المشروع"
                                    >
                                        <Settings className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Project Modal */}
            <Modal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="إنشاء مشروع جديد"
                size="md"
            >
                <form onSubmit={handleCreateProject} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">اسم المشروع</label>
                        <input
                            type="text" required autoFocus
                            placeholder="مثال: توزيع كسوة الشتاء 1447"
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            className="input-field"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">عدد المخصصات للفرد</label>
                            <input
                                type="number" min="1" max="50"
                                value={cardsCount}
                                onChange={e => setCardsCount(parseInt(e.target.value) || 1)}
                                className="input-field text-center font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">رمز الانضمام (اختياري)</label>
                            <input
                                type="text" placeholder="مثال: 7788"
                                value={passcode}
                                onChange={e => setPasscode(e.target.value)}
                                disabled={isPublic}
                                className="input-field disabled:bg-slate-50 disabled:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="flex gap-5 pt-1">
                        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700">
                            <input type="checkbox" checked={requiresCards} onChange={e => setRequiresCards(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                            يتطلب مسح أرقام بطاقات
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700">
                            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                            مشروع عام (كل الموزعين)
                        </label>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">إلغاء</Button>
                        <Button type="submit" variant="primary" loading={isCreating} icon={<FolderPlus className="w-4 h-4" />} className="flex-1">
                            إنشاء المشروع
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
