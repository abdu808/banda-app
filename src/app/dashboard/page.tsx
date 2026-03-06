'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { FolderPlus, Settings, Users, LayoutDashboard, PlayCircle, CheckSquare, PauseCircle, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Project {
    id: string;
    name: string;
    status: string;
    created_at: string;
    requires_cards: boolean;
    received_count?: number;
    total_count?: number;
}

const STATUS_MAP: Record<string, { label: string; bg: string; dot: string }> = {
    active: { label: 'نشط', bg: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
    paused: { label: 'موقوف', bg: 'bg-orange-100 text-orange-800', dot: 'bg-orange-400' },
    completed: { label: 'مكتمل', bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
    closed: { label: 'مغلق', bg: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
};

export default function DashboardPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [globalStats, setGlobalStats] = useState({ totalBeneficiaries: 0, totalReceived: 0, activeProjects: 0 });
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Create project form
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [requiresCards, setRequiresCards] = useState(true);
    const [cardsCount, setCardsCount] = useState(2);
    const [isPublic, setIsPublic] = useState(false);
    const [passcode, setPasscode] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Join project
    const [joinPasscode, setJoinPasscode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    const checkUser = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role === 'admin' || user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
            setIsAdmin(true);
        }
    }, []);

    const fetchProjectData = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, status, created_at, requires_cards')
                .order('created_at', { ascending: false });
            if (error) throw error;

            // Fetch per-project received/total counts in parallel
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
        checkUser();
        fetchProjectData();
    }, [checkUser, fetchProjectData]);

    const handleJoinProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinPasscode.trim()) return;
        setIsJoining(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('يرجى تسجيل الدخول');
            const { data: project, error: findError } = await supabase.from('projects').select('id, name').eq('passcode', joinPasscode.trim()).single();
            if (findError || !project) throw new Error('رمز الدخول غير صحيح');
            const { data: profile } = await supabase.from('profiles').select('allowed_projects').eq('id', user.id).single();
            const existingProjects = profile?.allowed_projects || [];
            if (existingProjects.includes(project.id)) throw new Error('أنت منضم لهذا المشروع مسبقاً');
            const { error: updateError } = await supabase.from('profiles').update({ allowed_projects: [...existingProjects, project.id] }).eq('id', user.id);
            if (updateError) throw updateError;
            toast.success(`تم الانضمام بنجاح لمشروع: ${project.name}`);
            setJoinPasscode('');
            setShowJoinModal(false);
            fetchProjectData();
        } catch (error: any) {
            toast.error(error.message || 'فشل الانضمام');
        } finally {
            setIsJoining(false);
        }
    };

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
            setNewProjectName(''); setRequiresCards(true); setCardsCount(2); setIsPublic(false); setPasscode('');
            setShowCreateModal(false);
        } catch (error: any) {
            toast.error(error.message || 'خطأ في الإنشاء');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-8">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
                    <p className="text-gray-500 mt-1 text-sm">إدارة مشاريع التوزيع وتتبع الإنجاز</p>
                </div>
                <div className="flex gap-2">
                    {!isAdmin && (
                        <button onClick={() => setShowJoinModal(true)} className="bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-50 transition shadow-sm">
                            انضمام لمشروع
                        </button>
                    )}
                    {isAdmin && (
                        <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition shadow-sm shadow-blue-200">
                            <FolderPlus className="w-4 h-4" /> مشروع جديد
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Grid (Admin only) */}
            {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
                        <p className="text-blue-100 text-sm font-medium">إجمالي المستفيدين</p>
                        <h3 className="text-4xl font-black mt-1">{globalStats.totalBeneficiaries.toLocaleString('ar-SA')}</h3>
                        <div className="mt-3 text-blue-200 text-sm">{globalStats.totalReceived.toLocaleString('ar-SA')} استلموا</div>
                        <Users className="absolute bottom-4 left-4 w-20 h-20 text-white/10" />
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-green-700 rounded-2xl p-6 text-white shadow-lg shadow-green-200 relative overflow-hidden">
                        <p className="text-green-100 text-sm font-medium">نسبة الإنجاز الكلية</p>
                        <h3 className="text-4xl font-black mt-1">
                            {globalStats.totalBeneficiaries > 0 ? Math.round((globalStats.totalReceived / globalStats.totalBeneficiaries) * 100) : 0}%
                        </h3>
                        <div className="mt-3 h-2 w-full bg-green-400/40 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-700"
                                style={{ width: `${globalStats.totalBeneficiaries > 0 ? (globalStats.totalReceived / globalStats.totalBeneficiaries) * 100 : 0}%` }}
                            />
                        </div>
                        <CheckSquare className="absolute bottom-4 left-4 w-20 h-20 text-white/10" />
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">المشاريع النشطة</p>
                            <h3 className="text-4xl font-black text-gray-900 mt-1">{globalStats.activeProjects}</h3>
                        </div>
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                            <PlayCircle className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>
                </div>
            )}

            {/* Project Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => <div key={i} className="h-48 bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse" />)}
                </div>
            ) : projects.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <LayoutDashboard className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700">لا توجد مشاريع حالياً</h3>
                    {isAdmin && <p className="mt-1 text-gray-400 text-sm">أنشئ أول مشروع للبدء</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {projects.map((project) => {
                        const st = STATUS_MAP[project.status] ?? STATUS_MAP.completed;
                        const pct = (project.total_count ?? 0) > 0
                            ? Math.round(((project.received_count ?? 0) / (project.total_count ?? 1)) * 100) : 0;
                        return (
                            <div key={project.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 overflow-hidden flex flex-col group">
                                <div className="p-6 flex-grow">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-base font-bold text-gray-900 line-clamp-2 leading-tight" title={project.name}>
                                            {project.name}
                                        </h3>
                                        <span className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full mr-2 ${st.bg}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                            {st.label}
                                        </span>
                                    </div>

                                    {/* Progress */}
                                    {(project.total_count ?? 0) > 0 && (
                                        <div className="mb-3">
                                            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                                                <span>الإنجاز</span>
                                                <span className="font-semibold text-gray-700">{project.received_count} / {project.total_count}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <div className="text-left text-xs text-gray-400 mt-1">{pct}%</div>
                                        </div>
                                    )}

                                    <p className="text-xs text-gray-400">
                                        {new Date(project.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>

                                <div className="bg-gray-50/80 px-6 py-3.5 border-t border-gray-100 flex gap-2">
                                    <button
                                        onClick={() => { if (project.status === 'active') router.push(`/dashboard/handover/${project.id}`); }}
                                        disabled={project.status !== 'active'}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${project.status === 'active'
                                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-200 active:scale-95'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        <Users className="w-4 h-4" />
                                        {project.status === 'active' ? 'بدء التسليم' : st.label}
                                    </button>
                                    {isAdmin && (
                                        <button
                                            onClick={() => router.push(`/dashboard/project/${project.id}`)}
                                            className="bg-white text-gray-600 border border-gray-200 p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
                                            title="إدارة المشروع"
                                        >
                                            <Settings className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Project Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">إنشاء مشروع جديد</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreateProject} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المشروع</label>
                                <input type="text" required autoFocus placeholder="مثال: توزيع كسوة الشتاء 1447" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                                    className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">عدد المخصصات للفرد</label>
                                    <input type="number" min="1" max="50" value={cardsCount} onChange={e => setCardsCount(parseInt(e.target.value) || 1)}
                                        className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm text-center font-bold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">رمز الانضمام (اختياري)</label>
                                    <input type="text" placeholder="مثال: 7788" value={passcode} onChange={e => setPasscode(e.target.value)} disabled={isPublic}
                                        className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm disabled:bg-gray-50 disabled:text-gray-400" />
                                </div>
                            </div>
                            <div className="flex gap-5 pt-1">
                                <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-gray-700">
                                    <input type="checkbox" checked={requiresCards} onChange={e => setRequiresCards(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                                    يتطلب مسح أرقام بطاقات
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-gray-700">
                                    <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
                                    مشروع عام (كل الموزعين)
                                </label>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition">إلغاء</button>
                                <button type="submit" disabled={isCreating} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center gap-2">
                                    {isCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><FolderPlus className="w-4 h-4" />إنشاء المشروع</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Join Project Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowJoinModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">الانضمام لمشروع</h2>
                            <button onClick={() => setShowJoinModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleJoinProject} className="p-6 space-y-4">
                            <p className="text-gray-500 text-sm">أدخل رمز الدخول السري الذي قدّمته لك الإدارة.</p>
                            <input type="text" autoFocus required placeholder="رمز المشروع..." value={joinPasscode} onChange={e => setJoinPasscode(e.target.value)}
                                className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-center text-lg font-mono tracking-widest" />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowJoinModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition">إلغاء</button>
                                <button type="submit" disabled={isJoining || !joinPasscode.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center">
                                    {isJoining ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'انضمام'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
