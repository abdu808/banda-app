'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Upload, Download, Users, CreditCard, Activity, Trash2, PauseCircle, PlayCircle, Lock, UserPlus, XCircle, FileText } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { calcPercent, formatNumber, getInitials, avatarColor, displayUsername } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

export default function ProjectSettingsPage() {
    const { id: projectId } = useParams();
    const router = useRouter();

    const [projectConfig, setProjectConfig] = useState<any>(null);
    const [stats, setStats] = useState({ totalBeni: 0, receivedBeni: 0, availableCards: 0 });
    const [isUploading, setIsUploading] = useState(false);

    const [allDistributors, setAllDistributors] = useState<any[]>([]);
    const [allowedUserIds, setAllowedUserIds] = useState<Set<string>>(new Set());
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [distSearch, setDistSearch] = useState('');
    const [showDistDropdown, setShowDistDropdown] = useState(false);

    useEffect(() => { fetchProjectData(); }, [projectId]);

    const fetchProjectData = async () => {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        setProjectConfig(proj);

        const { count: totalBeni } = await supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
        const { count: receivedBeni } = await supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'received');
        const { count: availableCards } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'available');

        setStats({ totalBeni: totalBeni || 0, receivedBeni: receivedBeni || 0, availableCards: availableCards || 0 });

        try {
            const res = await fetch('/api/admin/distributors');
            const json = await res.json();
            const distributors = json.distributors || [];
            setAllDistributors(distributors);
            const withAccess = distributors.filter((u: any) => Array.isArray(u.allowed_projects) && u.allowed_projects.includes(projectId));
            setAllowedUserIds(new Set(withAccess.map((u: any) => u.id)));
        } catch {
            setAllDistributors([]);
            setAllowedUserIds(new Set());
        }
    };

    const downloadBeneficiaryTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([['الاسم الكامل', 'رقم الهوية', 'رقم الجوال (اختياري)', 'عدد المخصصات (اختياري)']]);
        ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المستفيدين');
        XLSX.writeFile(wb, 'نموذج_رفع_المستفيدين.xlsx');
    };

    const downloadCardsTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([['رقم البطاقة', 'قيمة/فئة البطاقة (اختياري)']]);
        ws['!cols'] = [{ wch: 20 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'البطاقات');
        XLSX.writeFile(wb, 'نموذج_رفع_البطاقات.xlsx');
    };

    const handleUploadBeneficiaries = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                if (rows.length < 2) throw new Error('الملف فارغ أو لا يحتوي على بيانات مستفيدين تحت العناوين.');
                const headers = (rows[0] as string[]).map(h => String(h || '').trim().toLowerCase());
                let nameIdx = headers.findIndex(h => h.includes('اسم'));
                let idIdx = headers.findIndex(h => h.includes('هوية') || h.includes('هويه') || h.includes('id'));
                let phoneIdx = headers.findIndex(h => h.includes('جوال') || h.includes('هاتف') || h.includes('رقم'));
                let countIdx = headers.findIndex(h => h.includes('مخصص') || h.includes('عدد') || h.includes('كمية') || h.includes('بطاقات'));
                if (nameIdx === -1) nameIdx = 0;
                if (idIdx === -1) idIdx = 1;
                if (phoneIdx === -1 && headers.length > 2) phoneIdx = 2;
                if (countIdx === -1 && headers.length > 3) countIdx = 3;
                const dataRows = rows.slice(1);
                const errors: string[] = [];
                dataRows.forEach((row, index) => {
                    const rowNum = index + 2;
                    if (!row[nameIdx] || String(row[nameIdx]).trim() === '') errors.push(`الصف ${rowNum}: الاسم مفقود`);
                    if (!row[idIdx] || String(row[idIdx]).trim() === '') errors.push(`الصف ${rowNum}: رقم الهوية مفقود`);
                });
                if (errors.length > 0) throw new Error(`يوجد أخطاء في الملف:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...والمزيد' : ''}`);
                const beneficiariesToInsert = dataRows.filter(row => row[nameIdx] && row[idIdx]).map(row => {
                    let parsedCount = null;
                    if (countIdx !== -1 && row[countIdx]) {
                        parsedCount = parseInt(String(row[countIdx]).replace(/[^0-9]/g, ''), 10);
                        if (isNaN(parsedCount) || parsedCount < 1) parsedCount = 1;
                    }
                    return {
                        project_id: projectId,
                        name: String(row[nameIdx]).trim(),
                        identity_number: String(row[idIdx]).trim(),
                        phone_number: phoneIdx !== -1 && row[phoneIdx] ? String(row[phoneIdx]).trim() : null,
                        assigned_cards_count: parsedCount,
                        status: 'pending'
                    };
                });
                if (beneficiariesToInsert.length === 0) throw new Error('الملف فارغ أو لا يطابق التنسيق المطلوب');
                const { error } = await supabase.from('beneficiaries').insert(beneficiariesToInsert);
                if (error) throw error;
                toast.success(`تم رفع ${beneficiariesToInsert.length} مستفيد بنجاح`);
                fetchProjectData();
            } catch (err: any) {
                toast.error(err.message || 'حدث خطأ أثناء رفع المستفيدين (تأكد من عدم تكرار الهويات)');
            } finally {
                setIsUploading(false);
                e.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleUploadCards = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                const dataRows = rows.slice(1);
                if (dataRows.length === 0) throw new Error('الملف فارغ لا يحتوي على بطاقات.');
                const errors: string[] = [];
                dataRows.forEach((row, index) => {
                    if (!row[0] || String(row[0]).trim() === '') errors.push(`الصف ${index + 2}: رقم البطاقة مفقود`);
                });
                if (errors.length > 0) throw new Error(`يوجد أخطاء في الملف:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...والمزيد' : ''}`);
                const cardsToInsert = dataRows.filter(row => row[0]).map(row => ({
                    project_id: projectId,
                    card_number: String(row[0]).trim(),
                    value: row[1] ? Number(row[1]) : 500,
                    status: 'available'
                }));
                if (cardsToInsert.length === 0) throw new Error('الملف فارغ أو لا يطابق التنسيق');
                const { error } = await supabase.from('cards').insert(cardsToInsert);
                if (error) throw error;
                toast.success(`تم رفع ${cardsToInsert.length} بطاقة بنجاح`);
                fetchProjectData();
            } catch (err: any) {
                toast.error('حدث خطأ أثناء رفع البطاقات (تأكد من عدم تكرار أرقام البطاقات)');
            } finally {
                setIsUploading(false);
                e.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportReport = async () => {
        try {
            const toastId = toast.loading('جاري تجهيز التقرير...');
            const { data: beneficiaries, error: bError } = await supabase
                .from('beneficiaries')
                .select('id, name, identity_number, phone_number, received_at, proxy_name, field_notes, cards ( card_number, value )')
                .eq('project_id', projectId)
                .eq('status', 'received');
            if (bError) throw bError;
            const reportData = beneficiaries.map(b => {
                const rowData: any = {
                    'اسم المستفيد': b.name,
                    'رقم الهوية': b.identity_number,
                    'رقم الجوال': b.phone_number || '',
                    'المستلم الفعلي': b.proxy_name || 'نفس المستفيد',
                    'تاريخ الاستلام': new Date(b.received_at).toLocaleString('en-GB'),
                    'ملاحظات': b.field_notes || '',
                };
                if (projectConfig?.requires_cards !== false) {
                    const cardsCount = projectConfig?.cards_per_beneficiary || 2;
                    let totalValue = 0;
                    for (let i = 0; i < cardsCount; i++) {
                        const card = b.cards?.[i];
                        rowData[`البطاقة ${i + 1}`] = card?.card_number || 'غير متوفر';
                        totalValue += card?.value || 0;
                    }
                    rowData['إجمالي القيمة'] = totalValue;
                }
                return rowData;
            });
            const worksheet = XLSX.utils.json_to_sheet(reportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'التقرير النهائي');
            XLSX.writeFile(workbook, `تقرير_المشروع_${projectId}.xlsx`);
            toast.dismiss(toastId);
            toast.success('تم تحميل التقرير');
        } catch {
            toast.error('خطأ في استخراج التقرير');
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        try {
            const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
            if (error) throw error;
            toast.success(`تم تحديث حالة المشروع`);
            fetchProjectData();
        } catch {
            toast.error('حدث خطأ أثناء تحديث حالة المشروع');
        }
    };

    const handleCloseProject = async () => {
        if (!confirm('هل أنت متأكد من إقفال المشروع؟ سيتم حذف جميع المستفيدين الذين لم يستلموا مخصصاتهم بعد.')) return;
        try {
            const { error: deleteError } = await supabase.from('beneficiaries').delete().eq('project_id', projectId).eq('status', 'pending');
            if (deleteError) throw deleteError;
            await handleUpdateStatus('completed');
            toast.success('تم إقفال المشروع وحذف الأسماء غير المستلمة');
        } catch {
            toast.error('حدث خطأ أثناء إقفال المشروع');
        }
    };

    const handleDeleteProject = async () => {
        if (!confirm('تحذير: هل أنت متأكد من حذف المشروع بالكامل؟ لن يمكن التراجع.')) return;
        try {
            const { error } = await supabase.from('projects').delete().eq('id', projectId);
            if (error) throw error;
            toast.success('تم حذف المشروع بنجاح');
            router.push('/dashboard');
        } catch {
            toast.error('حدث خطأ أثناء حذف المشروع');
        }
    };

    const toggleAccess = async (user: any) => {
        setTogglingId(user.id);
        const hadAccess = allowedUserIds.has(user.id);
        setAllowedUserIds(prev => { const next = new Set(prev); hadAccess ? next.delete(user.id) : next.add(user.id); return next; });
        try {
            const res = await fetch('/api/admin/toggle-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, projectId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'خطأ في تحديث الصلاحية');
            setAllowedUserIds(prev => { const next = new Set(prev); data.hasAccess ? next.add(user.id) : next.delete(user.id); return next; });
            toast.success(data.hasAccess ? `تمت إضافة ${user.name || displayUsername(user.email)}` : `تم سحب صلاحية ${user.name || displayUsername(user.email)}`);
        } catch (err: any) {
            setAllowedUserIds(prev => { const next = new Set(prev); hadAccess ? next.add(user.id) : next.delete(user.id); return next; });
            toast.error(err.message || 'حدث خطأ أثناء تحديث الصلاحية');
        } finally {
            setTogglingId(null);
        }
    };

    const pct = calcPercent(stats.receivedBeni, stats.totalBeni);
    const requiresCards = projectConfig?.requires_cards !== false;
    const isActive = projectConfig?.status === 'active';

    return (
        <div className="space-y-6 max-w-5xl pb-16">
            <Toaster position="top-center" />

            <PageHeader
                title={projectConfig?.name || 'إدارة المشروع'}
                description="تتبع التسليم ورفع البيانات وإدارة الصلاحيات"
                backHref="/dashboard"
                icon={<StatusBadge status={projectConfig?.status || 'active'} />}
                actions={
                    <div className="flex flex-wrap gap-2">
                        {isActive ? (
                            <Button variant="secondary" icon={<PauseCircle className="w-4 h-4" />} onClick={() => handleUpdateStatus('paused')}>
                                إيقاف مؤقت
                            </Button>
                        ) : (
                            <Button variant="success" icon={<PlayCircle className="w-4 h-4" />} onClick={() => handleUpdateStatus('active')}>
                                تفعيل للتوزيع
                            </Button>
                        )}
                        <Button variant="secondary" icon={<Lock className="w-4 h-4" />} onClick={handleCloseProject}>
                            إقفال نهائي
                        </Button>
                        <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={handleDeleteProject}>
                            حذف
                        </Button>
                    </div>
                }
            />

            {/* Stats */}
            <div className={`grid grid-cols-1 gap-4 ${requiresCards ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                <StatCard variant="blue" icon={<Users className="w-6 h-6" />} label="إجمالي المستفيدين" value={formatNumber(stats.totalBeni)} />
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-white/70 text-sm font-medium">تم التسليم</p>
                            <h3 className="text-3xl font-black mt-1 tabular-nums">{formatNumber(stats.receivedBeni)}</h3>
                            <div className="mt-1 text-white/60 text-sm">المتبقي: {formatNumber(stats.totalBeni - stats.receivedBeni)}</div>
                        </div>
                        <button
                            onClick={() => router.push(`/dashboard/reports/${projectId}`)}
                            className="text-xs font-semibold text-emerald-700 bg-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition flex-shrink-0"
                        >
                            <FileText className="w-3 h-3 inline ml-1" />
                            السجل
                        </button>
                    </div>
                    {stats.totalBeni > 0 && (
                        <div className="mt-3 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-white/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                    )}
                </div>
                {requiresCards && (
                    <StatCard variant="purple" icon={<CreditCard className="w-6 h-6" />} label="البطاقات المتاحة" value={formatNumber(stats.availableCards)} />
                )}
            </div>

            {/* Upload sections */}
            <div className={`grid grid-cols-1 gap-5 ${requiresCards ? 'md:grid-cols-2' : ''}`}>
                {/* Beneficiaries */}
                <div className="card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">إضافة مستفيدين (Excel)</h3>
                        </div>
                        <button onClick={downloadBeneficiaryTemplate} className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition font-medium">
                            <Download className="w-3.5 h-3.5" />
                            نموذج
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 border border-slate-100 leading-relaxed">
                        الأعمدة: الاسم الكامل — رقم الهوية — رقم الجوال (اختياري) — عدد المخصصات (اختياري). النظام يتعرف على الأعمدة تلقائياً.
                    </p>
                    <label className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${isUploading ? 'border-blue-300 bg-blue-50 cursor-not-allowed' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'}`}>
                        <input type="file" accept=".xlsx,.xls" onChange={handleUploadBeneficiaries} disabled={isUploading} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                        <Upload className="w-7 h-7 text-slate-400 mb-2" />
                        <span className="text-sm text-slate-500 font-medium">{isUploading ? 'جاري الرفع...' : 'اضغط أو اسحب ملف الإكسل'}</span>
                    </label>
                </div>

                {/* Cards */}
                {requiresCards && (
                    <div className="card p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                                    <CreditCard className="w-4 h-4 text-purple-600" />
                                </div>
                                <h3 className="font-bold text-slate-800">إضافة بطاقات (Excel)</h3>
                            </div>
                            <button onClick={downloadCardsTemplate} className="flex items-center gap-1.5 text-xs text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg transition font-medium">
                                <Download className="w-3.5 h-3.5" />
                                نموذج
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 border border-slate-100 leading-relaxed">
                            الأعمدة: رقم البطاقة — القيمة/الفئة (اختياري). لا يُسمح بتكرار نفس رقم البطاقة.
                        </p>
                        <label className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${isUploading ? 'border-purple-300 bg-purple-50 cursor-not-allowed' : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'}`}>
                            <input type="file" accept=".xlsx,.xls" onChange={handleUploadCards} disabled={isUploading} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                            <Upload className="w-7 h-7 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-500 font-medium">{isUploading ? 'جاري الرفع...' : 'اضغط أو اسحب ملف الإكسل'}</span>
                        </label>
                    </div>
                )}
            </div>

            {/* Export */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold mb-1">التقرير النهائي للمشروع</h3>
                    <p className="text-slate-300 text-sm">ملف Excel شامل بجميع المستفيدين الذين استلموا مخصصاتهم مع أرقام البطاقات.</p>
                </div>
                <button onClick={handleExportReport} className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-100 transition flex-shrink-0">
                    <Download className="w-4 h-4" />
                    تصدير التقرير
                </button>
            </div>

            {/* Access Management */}
            <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-600" />
                        صلاحيات الوصول — الموزعين
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                        {projectConfig?.is_public
                            ? 'المشروع عام — جميع الموزعين يمكنهم رؤيته'
                            : 'اختر الموزعين الذين يحق لهم الوصول لهذا المشروع'}
                    </p>
                </div>

                {!projectConfig?.is_public && (
                    <div className="p-5 space-y-4">
                        {allowedUserIds.size > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {allDistributors.filter(u => allowedUserIds.has(u.id)).map(user => {
                                    const initials = getInitials(user.name || '', user.email);
                                    const bg = avatarColor(user.email);
                                    return (
                                        <div key={user.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-xl text-sm font-semibold">
                                            <div className={`w-5 h-5 rounded-full ${bg} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>
                                                {initials}
                                            </div>
                                            <span>{user.name || displayUsername(user.email)}</span>
                                            <button
                                                onClick={() => toggleAccess(user)}
                                                disabled={togglingId === user.id}
                                                className="text-blue-400 hover:text-red-500 transition disabled:opacity-40"
                                                title="سحب الصلاحية"
                                            >
                                                {togglingId === user.id
                                                    ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                                    : <XCircle className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {allDistributors.filter(u => !allowedUserIds.has(u.id)).length > 0 ? (
                            <div className="relative">
                                <div
                                    className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50 cursor-pointer hover:border-blue-400 transition"
                                    onClick={() => setShowDistDropdown(v => !v)}
                                >
                                    <UserPlus className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    <input
                                        className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400 cursor-pointer"
                                        placeholder="ابحث واختر موزعاً..."
                                        value={distSearch}
                                        onChange={e => { setDistSearch(e.target.value); setShowDistDropdown(true); }}
                                        onFocus={() => setShowDistDropdown(true)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                </div>
                                {showDistDropdown && (
                                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                        {allDistributors
                                            .filter(u => !allowedUserIds.has(u.id))
                                            .filter(u => !distSearch || (u.name || u.email || '').toLowerCase().includes(distSearch.toLowerCase()))
                                            .map(user => {
                                                const initials = getInitials(user.name || '', user.email);
                                                const bg = avatarColor(user.email);
                                                return (
                                                    <div
                                                        key={user.id}
                                                        className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition text-sm"
                                                        onClick={() => { toggleAccess(user); setDistSearch(''); setShowDistDropdown(false); }}
                                                    >
                                                        <div className={`w-7 h-7 rounded-full ${bg} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{user.name || 'بدون اسم'}</p>
                                                            <p className="text-xs text-slate-400">{displayUsername(user.email)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        {allDistributors
                                            .filter(u => !allowedUserIds.has(u.id))
                                            .filter(u => !distSearch || (u.name || u.email || '').toLowerCase().includes(distSearch.toLowerCase())).length === 0 && (
                                                <div className="px-4 py-3 text-sm text-slate-400 text-center">لا توجد نتائج</div>
                                            )}
                                    </div>
                                )}
                            </div>
                        ) : allDistributors.length === 0 ? (
                            <div className="text-center py-6">
                                <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">لا يوجد موزعون في النظام</p>
                                <p className="text-xs text-slate-300 mt-0.5">أضف موزعين من صفحة المستخدمين أولاً</p>
                            </div>
                        ) : (
                            <p className="text-xs text-emerald-600 font-medium">جميع الموزعين في النظام لديهم صلاحية</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
