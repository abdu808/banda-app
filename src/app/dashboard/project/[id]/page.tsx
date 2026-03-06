'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Upload, Download, Users, CreditCard, Activity, ArrowRight, Trash2, PauseCircle, PlayCircle, Lock, UserPlus, XCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function ProjectSettingsPage() {
    const { id: projectId } = useParams();
    const router = useRouter();

    const [projectConfig, setProjectConfig] = useState<any>(null);
    const [stats, setStats] = useState({
        totalBeni: 0,
        receivedBeni: 0,
        availableCards: 0
    });

    const [isUploading, setIsUploading] = useState(false);

    // Access management
    const [allDistributors, setAllDistributors] = useState<any[]>([]);
    const [allowedUserIds, setAllowedUserIds] = useState<Set<string>>(new Set());
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [distSearch, setDistSearch] = useState('');
    const [showDistDropdown, setShowDistDropdown] = useState(false);

    useEffect(() => {
        fetchProjectData();
    }, [projectId]);

    const fetchProjectData = async () => {
        // Fetch project config
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        setProjectConfig(proj);

        // Fetch stats
        const { count: totalBeni } = await supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
        const { count: receivedBeni } = await supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'received');
        const { count: availableCards } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'available');

        setStats({
            totalBeni: totalBeni || 0,
            receivedBeni: receivedBeni || 0,
            availableCards: availableCards || 0,
        });

        // Fetch ALL distributors via server API (bypasses RLS)
        try {
            const res = await fetch('/api/admin/distributors');
            const json = await res.json();
            const distributors = json.distributors || [];
            setAllDistributors(distributors);

            // Extract which distributors already have access
            const withAccess = distributors.filter((u: any) =>
                Array.isArray(u.allowed_projects) && u.allowed_projects.includes(projectId)
            );
            setAllowedUserIds(new Set(withAccess.map((u: any) => u.id)));
        } catch {
            setAllDistributors([]);
            setAllowedUserIds(new Set());
        }
    };

    const downloadBeneficiaryTemplate = () => {
        const templateData = [[
            'الاسم الكامل',
            'رقم الهوية',
            'رقم الجوال (اختياري)',
            'عدد المخصصات (اختياري)',
        ]];
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        // Auto-width columns
        ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المستفيدين');
        XLSX.writeFile(wb, 'نموذج_رفع_المستفيدين.xlsx');
    };

    const downloadCardsTemplate = () => {
        const templateData = [[
            'رقم البطاقة',
            'قيمة/فئة البطاقة (اختياري)',
        ]];
        const ws = XLSX.utils.aoa_to_sheet(templateData);
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

                // Validate Structure and Data
                const errors: string[] = [];
                if (rows.length < 2) {
                    throw new Error('الملف فارغ أو لا يحتوي على بيانات مستفيدين تحت العناوين.');
                }

                // Dynamic Header mapping
                const headers = (rows[0] as string[]).map(h => String(h || '').trim().toLowerCase());

                let nameIdx = headers.findIndex(h => h.includes('اسم'));
                let idIdx = headers.findIndex(h => h.includes('هوية') || h.includes('هويه') || h.includes('id'));
                let phoneIdx = headers.findIndex(h => h.includes('جوال') || h.includes('هاتف') || h.includes('رقم'));
                let countIdx = headers.findIndex(h => h.includes('مخصص') || h.includes('عدد') || h.includes('كمية') || h.includes('بطاقات'));

                // Fallback to strict indices if headers are completely unrecognized
                if (nameIdx === -1) nameIdx = 0;
                if (idIdx === -1) idIdx = 1;
                if (phoneIdx === -1 && headers.length > 2) phoneIdx = 2;
                if (countIdx === -1 && headers.length > 3) countIdx = 3;

                const dataRows = rows.slice(1);

                dataRows.forEach((row, index) => {
                    const rowNum = index + 2; // +1 for 0-index, +1 for header
                    if (!row[nameIdx] || String(row[nameIdx]).trim() === '') {
                        errors.push(`الصف ${rowNum}: الاسم مفقود`);
                    }
                    if (!row[idIdx] || String(row[idIdx]).trim() === '') {
                        errors.push(`الصف ${rowNum}: رقم الهوية مفقود`);
                    }
                });

                if (errors.length > 0) {
                    throw new Error(`يوجد أخطاء في الملف:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...والمزيد' : ''}`);
                }

                const beneficiariesToInsert = dataRows
                    .filter(row => row[nameIdx] && row[idIdx]) // safeguard
                    .map(row => {
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

                const { error } = await supabase
                    .from('beneficiaries')
                    .insert(beneficiariesToInsert);

                if (error) throw error;

                toast.success(`تم رفع ${beneficiariesToInsert.length} مستفيد بنجاح`);
                fetchProjectData();
            } catch (err: any) {
                toast.error(err.message || 'حدث خطأ أثناء رفع المستفيدين (تأكد من عدم تكرار الهويات)');
            } finally {
                setIsUploading(false);
                e.target.value = ''; // reset
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

                // Validate Structure and Data
                const errors: string[] = [];
                const dataRows = rows.slice(1);

                if (dataRows.length === 0) {
                    throw new Error('الملف فارغ لا يحتوي على بطاقات.');
                }

                dataRows.forEach((row, index) => {
                    const rowNum = index + 2;
                    if (!row[0] || String(row[0]).trim() === '') {
                        errors.push(`الصف ${rowNum}: رقم البطاقة مفقود`);
                    }
                });

                if (errors.length > 0) {
                    throw new Error(`يوجد أخطاء في الملف:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...والمزيد' : ''}`);
                }

                // Assuming Excel format: [Card Number, Value (optional)]
                const cardsToInsert = dataRows
                    .filter(row => row[0])
                    .map(row => ({
                        project_id: projectId,
                        card_number: String(row[0]).trim(),
                        value: row[1] ? Number(row[1]) : 500,
                        status: 'available'
                    }));

                if (cardsToInsert.length === 0) throw new Error('الملف فارغ أو لا يطابق التنسيق');

                const { error } = await supabase
                    .from('cards')
                    .insert(cardsToInsert);

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

            // Fetch all beneficiaries who received cards for this project
            const { data: beneficiaries, error: bError } = await supabase
                .from('beneficiaries')
                .select(`
          id, name, identity_number, phone_number, received_at, proxy_name, field_notes,
          cards ( card_number, value )
        `)
                .eq('project_id', projectId)
                .eq('status', 'received');

            if (bError) throw bError;

            // Format data for Excel
            const reportData = beneficiaries.map(b => {
                const rowData: any = {
                    'اسم المستفيد': b.name,
                    'رقم الهوية': b.identity_number,
                    'رقم الجوال': b.phone_number || '',
                    'المستلم الفعلي (في حال التفويض)': b.proxy_name || 'نفس المستفيد',
                    'تاريخ وتوقيت الاستلام': new Date(b.received_at).toLocaleString('ar-SA'),
                    'ملاحظات ميدانية': b.field_notes || '',
                };

                // Add dynamic card columns if project requires cards
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
        } catch (err: any) {
            toast.error('خطأ في استخراج التقرير');
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        try {
            const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
            if (error) throw error;
            toast.success(`تم تحديث حالة المشروع إلى: ${newStatus}`);
            fetchProjectData();
        } catch (error) {
            toast.error('حدث خطأ أثناء تحديث حالة المشروع');
        }
    };

    const handleCloseProject = async () => {
        if (!confirm('هل أنت متأكد من إقفال المشروع؟ سيتم حذف جميع المستفيدين الذين لم يستلموا مخصصاتهم بعد.')) return;
        try {
            // Delete all pending beneficiaries
            const { error: deleteError } = await supabase.from('beneficiaries').delete().eq('project_id', projectId).eq('status', 'pending');
            if (deleteError) throw deleteError;

            // Update status to completed
            await handleUpdateStatus('completed');
            toast.success('تم إقفال المشروع وحذف الأسماء غير المستلمة بنجاح');
        } catch (error) {
            toast.error('حدث خطأ أثناء إقفال المشروع');
        }
    };

    const handleDeleteProject = async () => {
        if (!confirm('تحذير خطير: هل أنت متأكد من حذف المشروع بالكامل؟ سيتم مسح جميع البيانات والإحصائيات الخاصة به ولن يمكن التراجع.')) return;
        try {
            const { error } = await supabase.from('projects').delete().eq('id', projectId);
            if (error) throw error;
            toast.success('تم حذف المشروع بنجاح');
            router.push('/dashboard');
        } catch (error) {
            toast.error('حدث خطأ أثناء حذف المشروع');
        }
    };

    const toggleAccess = async (user: any) => {
        setTogglingId(user.id);
        const hadAccess = allowedUserIds.has(user.id);

        // Optimistic UI Update
        setAllowedUserIds(prev => {
            const next = new Set(prev);
            hadAccess ? next.delete(user.id) : next.add(user.id);
            return next;
        });

        try {
            const res = await fetch('/api/admin/toggle-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, projectId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'خطأ في تحديث الصلاحية');

            // Confirm Server State
            setAllowedUserIds(prev => {
                const next = new Set(prev);
                data.hasAccess ? next.add(user.id) : next.delete(user.id);
                return next;
            });
            toast.success(data.hasAccess ? `✅ تمت إضافة ${user.name || user.email}` : `تم سحب صلاحية ${user.name || user.email}`);
        } catch (err: any) {
            // Revert Optimistic Update on failure
            setAllowedUserIds(prev => {
                const next = new Set(prev);
                hadAccess ? next.add(user.id) : next.delete(user.id);
                return next;
            });
            toast.error(err.message || 'حدث خطأ أثناء تحديث الصلاحية');
        } finally {
            setTogglingId(null);
        }
    };


    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            <Toaster position="top-center" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-900 p-2 bg-white rounded-lg border shadow-sm flex-shrink-0">
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">{projectConfig?.name || 'إدارة المشروع'}</h1>
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${projectConfig?.status === 'active' ? 'bg-green-100 text-green-800' :
                                projectConfig?.status === 'paused' ? 'bg-orange-100 text-orange-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {projectConfig?.status === 'active' ? 'نشط' :
                                    projectConfig?.status === 'paused' ? 'موقوف مؤقتاً' : 'مكتمل/مغلق'}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm mt-1">تتبع التسليم ورفع البيانات للمشروع الحالي</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {projectConfig?.status === 'active' ? (
                        <button onClick={() => handleUpdateStatus('paused')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 text-sm font-medium rounded-lg hover:bg-orange-200 transition-colors border border-orange-200">
                            <PauseCircle className="w-4 h-4" /> إيقاف مؤقت
                        </button>
                    ) : (
                        <button onClick={() => handleUpdateStatus('active')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-100 text-green-700 px-4 py-2 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors border border-green-200">
                            <PlayCircle className="w-4 h-4" /> تفعيل للتوزيع
                        </button>
                    )}

                    <button onClick={handleCloseProject} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors border border-gray-200" title="يغلق المشروع ويحذف الأسماء التي لم تستلم">
                        <Lock className="w-4 h-4" /> إقفال نهائي
                    </button>

                    <button onClick={handleDeleteProject} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-50 text-red-600 px-4 py-2 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors border border-red-200">
                        <Trash2 className="w-4 h-4" /> حذف بالكامل
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-blue-50 rounded-xl text-blue-600">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">إجمالي المستفيدين</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.totalBeni}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-green-50 rounded-xl text-green-600">
                            <Activity className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">تم التسليم لهم</p>
                            <p className="text-3xl font-bold text-green-600">{stats.receivedBeni}</p>
                            <p className="text-xs text-gray-400 mt-1">المتبقي: {stats.totalBeni - stats.receivedBeni}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push(`/dashboard/reports/${projectId}`)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition whitespace-nowrap"
                    >
                        عرض السجل التفصيلي
                    </button>
                </div>

                {projectConfig?.requires_cards !== false && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-4 bg-purple-50 rounded-xl text-purple-600">
                            <CreditCard className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">البطاقات المتاحة بالصندوق</p>
                            <p className="text-3xl font-bold text-purple-600">{stats.availableCards}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className={`grid grid-cols-1 gap-6 ${projectConfig?.requires_cards !== false ? 'md:grid-cols-2' : ''}`}>
                {/* Upload Beneficiaries */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-blue-800">
                            <Users className="w-5 h-5" />
                            <h3 className="text-base font-bold">إضافة مستفيدين (Excel)</h3>
                        </div>
                        <button
                            onClick={downloadBeneficiaryTemplate}
                            className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition font-medium"
                        >
                            <Download className="w-3.5 h-3.5" />
                            تحميل نموذج الإكسل
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        💡 الأعمدة المتوقعة: الاسم الكامل — رقم الهوية — رقم الجوال (اختياري) — عدد المخصصات (اختياري).
                        النظام يتعرف على الأعمدة تلقائياً من العنوان.
                    </p>
                    <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isUploading ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'}`}>
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleUploadBeneficiaries}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <Upload className="mx-auto h-7 w-7 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500 font-medium">{isUploading ? 'جاري الرفع...' : 'اضغط أو اسحب ملف الإكسل هنا'}</span>
                    </div>
                </div>

                {/* Upload Cards */}
                {projectConfig?.requires_cards !== false && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-purple-800">
                                <CreditCard className="w-5 h-5" />
                                <h3 className="text-base font-bold">إضافة بطاقات (Excel)</h3>
                            </div>
                            <button
                                onClick={downloadCardsTemplate}
                                className="flex items-center gap-1.5 text-xs text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition font-medium"
                            >
                                <Download className="w-3.5 h-3.5" />
                                تحميل نموذج الإكسل
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
                            💡 الأعمدة المتوقعة: رقم البطاقة — القيمة/الفئة (اختياري). لا يُسمح بتكرار نفس رقم البطاقة.
                        </p>
                        <div className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isUploading ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'}`}>
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleUploadCards}
                                disabled={isUploading}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <Upload className="mx-auto h-7 w-7 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500 font-medium">{isUploading ? 'جاري الرفع...' : 'اضغط أو اسحب ملف الإكسل هنا'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Export Report */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl shadow-lg p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                    <h3 className="text-xl font-bold mb-2">التقرير النهائي للمشروع</h3>
                    <p className="text-gray-300 text-sm max-w-md">
                        قم بتحميل ملف Excel شامل يحتوي على أسماء جميع المستفيدين الذين استلموا مخصصاتهم، مدعوماً بأرقام هوياتهم وأرقام البطاقات التي صرفت لهم.
                    </p>
                </div>
                <button
                    onClick={handleExportReport}
                    className="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-100 transition-colors flex-shrink-0"
                >
                    <Download className="w-5 h-5" />
                    تصدير التقرير الآن
                </button>
            </div>

            {/* Access Management — Dropdown + Chips */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-600" />
                        صلاحيات الوصول — الموزعين
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">
                        {projectConfig?.is_public
                            ? '⚠️ المشروع عام — جميع الموزعين يمكنهم رؤيته'
                            : 'اختر الموزعين الذين يحق لهم الوصول لهذا المشروع'}
                    </p>
                </div>

                {!projectConfig?.is_public && (
                    <div className="p-6 space-y-4">

                        {/* Chips — distributors with access */}
                        {allowedUserIds.size > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {allDistributors.filter(u => allowedUserIds.has(u.id)).map(user => (
                                    <div key={user.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-xl text-sm font-semibold">
                                        <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                            {(user.name || user.email || '?').charAt(0).toUpperCase()}
                                        </span>
                                        <span>{user.name || user.email}</span>
                                        <button
                                            onClick={() => toggleAccess(user)}
                                            disabled={togglingId === user.id}
                                            className="text-blue-400 hover:text-red-500 transition ml-1 disabled:opacity-40"
                                            title="سحب الصلاحية"
                                        >
                                            {togglingId === user.id
                                                ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                                : <XCircle className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Dropdown selector */}
                        {allDistributors.filter(u => !allowedUserIds.has(u.id)).length > 0 ? (
                            <div className="relative">
                                <div
                                    className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 cursor-pointer hover:border-blue-400 transition"
                                    onClick={() => setShowDistDropdown(v => !v)}
                                >
                                    <UserPlus className="w-4 h-4 text-gray-400" />
                                    <input
                                        className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 cursor-pointer"
                                        placeholder="ابحث واختر موزعاً..."
                                        value={distSearch}
                                        onChange={e => { setDistSearch(e.target.value); setShowDistDropdown(true); }}
                                        onFocus={() => setShowDistDropdown(true)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                </div>
                                {showDistDropdown && (
                                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                        {allDistributors
                                            .filter(u => !allowedUserIds.has(u.id))
                                            .filter(u => !distSearch || (u.name || u.email || '').toLowerCase().includes(distSearch.toLowerCase()))
                                            .map(user => (
                                                <div
                                                    key={user.id}
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer transition text-sm"
                                                    onClick={() => {
                                                        toggleAccess(user);
                                                        setDistSearch('');
                                                        setShowDistDropdown(false);
                                                    }}
                                                >
                                                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xs font-bold text-gray-600">
                                                            {(user.name || user.email || '?').charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{user.name || 'بدون اسم'}</p>
                                                        <p className="text-xs text-gray-400">{user.email}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        {allDistributors.filter(u => !allowedUserIds.has(u.id)).filter(u => !distSearch || (u.name || u.email || '').toLowerCase().includes(distSearch.toLowerCase())).length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-400 text-center">لا توجد نتائج</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : allDistributors.length === 0 ? (
                            <div className="text-center py-6">
                                <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">لا يوجد موزعون في النظام</p>
                                <p className="text-xs text-gray-300 mt-0.5">أضف موزعين من صفحة المستخدمين أولاً</p>
                            </div>
                        ) : (
                            <p className="text-xs text-green-600 font-medium">✅ جميع الموزعين في النظام لديهم صلاحية</p>
                        )}

                    </div>
                )}
            </div>

        </div>
    );
}


