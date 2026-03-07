'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { Search, FileDown, ArrowUpDown, CheckCircle, Clock, CreditCard, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import { formatNumber } from '@/lib/utils';
import { PAGINATION_STEP } from '@/lib/constants';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';

type Tab = 'received' | 'pending' | 'unused_cards';

export default function ComprehensiveReportPage() {
    const { id: projectId } = useParams();

    const [projectConfig, setProjectConfig] = useState<any>(null);
    const [stats, setStats] = useState({ totalBeni: 0, receivedBeni: 0, pendingBeni: 0, availableCards: 0 });

    const [receivedBeni, setReceivedBeni] = useState<any[]>([]);
    const [pendingBeni, setPendingBeni] = useState<any[]>([]);
    const [unusedCards, setUnusedCards] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('received');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        fetchData();
        if (activeTab === 'received') setSortField('received_at');
        else if (activeTab === 'unused_cards') setSortField('card_number');
        else setSortField('name');
    }, [projectId, activeTab]);

    const fetchAllRecords = async (table: string, selectDef: string, conditions: Record<string, string>) => {
        let allData: any[] = [];
        let from = 0;
        while (true) {
            let query = supabase.from(table).select(selectDef).range(from, from + PAGINATION_STEP);
            for (const [key, value] of Object.entries(conditions)) {
                query = query.eq(key, value);
            }
            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            if (data.length <= PAGINATION_STEP) break;
            from += PAGINATION_STEP + 1;
        }
        return allData;
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: proj, error: projError } = await supabase
                .from('projects')
                .select('name, requires_cards, cards_per_beneficiary')
                .eq('id', projectId)
                .single();
            if (projError) throw projError;
            setProjectConfig(proj);

            const receivedData = await fetchAllRecords('beneficiaries', 'id, name, identity_number, phone_number, received_at, assigned_cards_count, distributed_by_name, cards ( card_number )', { project_id: projectId as string, status: 'received' });
            setReceivedBeni((receivedData || []).map(b => ({ ...b, card_numbers: b.cards ? b.cards.map((c: any) => c.card_number).join(' ، ') : '' })));

            const pendingData = await fetchAllRecords('beneficiaries', 'id, name, identity_number, phone_number, assigned_cards_count', { project_id: projectId as string, status: 'pending' });
            setPendingBeni(pendingData || []);

            let availableCardsData: any[] = [];
            if (proj.requires_cards) {
                availableCardsData = await fetchAllRecords('cards', 'id, card_number, value', { project_id: projectId as string, status: 'available' });
                setUnusedCards(availableCardsData);
            }

            setStats({
                totalBeni: (receivedData?.length || 0) + (pendingData?.length || 0),
                receivedBeni: receivedData?.length || 0,
                pendingBeni: pendingData?.length || 0,
                availableCards: availableCardsData.length
            });
        } catch {
            toast.error('حدث خطأ أثناء جلب التقارير');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: string) => {
        if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDirection(field === 'received_at' ? 'desc' : 'asc'); }
    };

    const getSortedAndFilteredData = () => {
        let currentData = activeTab === 'received' ? receivedBeni : activeTab === 'pending' ? pendingBeni : unusedCards;
        return currentData
            .filter(item => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                if (activeTab === 'unused_cards') return item.card_number && item.card_number.includes(q);
                return (item.name && item.name.toLowerCase().includes(q)) || (item.identity_number && item.identity_number.includes(q)) || (item.phone_number && item.phone_number.includes(q)) || (item.card_numbers && item.card_numbers.includes(q));
            })
            .sort((a, b) => {
                let cmp = 0;
                if (activeTab === 'unused_cards') cmp = (a[sortField] || '').localeCompare(b[sortField] || '');
                else if (sortField === 'received_at' && a.received_at && b.received_at) cmp = new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
                else cmp = (a[sortField] || '').localeCompare(b[sortField] || '', 'ar');
                return sortDirection === 'asc' ? cmp : -cmp;
            });
    };

    const exportToExcel = () => {
        const filteredData = getSortedAndFilteredData();
        let dataToExport: any[] = [];
        let sheetName = '';
        if (activeTab === 'received') {
            sheetName = 'المستلمين';
            dataToExport = filteredData.map(b => ({
                'اسم المستفيد': b.name,
                'الهوية': b.identity_number,
                'الجوال': b.phone_number || '',
                'تاريخ الاستلام': b.received_at ? new Date(b.received_at).toLocaleString('ar-SA') : '',
                'الموزع': b.distributed_by_name || 'المدير',
                'الكمية': b.assigned_cards_count || projectConfig?.cards_per_beneficiary || 0,
                'أرقام البطاقات': b.card_numbers || 'لا توجد',
            }));
        } else if (activeTab === 'pending') {
            sheetName = 'المتبقين';
            dataToExport = filteredData.map(b => ({ 'اسم المستفيد': b.name, 'الهوية': b.identity_number, 'الجوال': b.phone_number || '', 'الكمية المستحقة': b.assigned_cards_count || projectConfig?.cards_per_beneficiary || 0 }));
        } else {
            sheetName = 'البطاقات_المتبقية';
            dataToExport = filteredData.map(c => ({ 'رقم البطاقة': c.card_number, 'القيمة': c.value || '-' }));
        }
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `تقرير_${sheetName}_${projectConfig?.name || 'مشروع'}.xlsx`);
    };

    const filteredData = getSortedAndFilteredData();

    const SortIcon = ({ field }: { field: string }) => (
        <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sortField === field ? 'text-blue-600' : 'text-slate-300'}`} />
    );

    const tabs = [
        { id: 'received' as Tab, label: 'المستلمين', icon: CheckCircle, color: 'blue' },
        { id: 'pending' as Tab, label: 'المتبقين', icon: Clock, color: 'amber' },
        ...(projectConfig?.requires_cards !== false ? [{ id: 'unused_cards' as Tab, label: 'البطاقات المتبقية', icon: CreditCard, color: 'purple' }] : []),
    ];

    return (
        <div className="space-y-5 pb-10">
            <Toaster position="top-center" />

            <PageHeader
                title="التقرير الشامل"
                description={projectConfig?.name}
                backHref="/dashboard/reports"
            />

            {/* Stats */}
            <div className={`grid grid-cols-2 gap-3 ${projectConfig?.requires_cards !== false ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                {[
                    { label: 'إجمالي الأسماء', value: stats.totalBeni, icon: <Users className="w-4 h-4" />, bg: 'bg-blue-50 text-blue-700 border-blue-100' },
                    { label: 'تم التسليم', value: stats.receivedBeni, icon: <CheckCircle className="w-4 h-4" />, bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                    { label: 'متبقي (لم يستلم)', value: stats.pendingBeni, icon: <Clock className="w-4 h-4" />, bg: 'bg-amber-50 text-amber-700 border-amber-100' },
                    ...(projectConfig?.requires_cards !== false ? [{ label: 'بطاقات غير مستخدمة', value: stats.availableCards, icon: <CreditCard className="w-4 h-4" />, bg: 'bg-violet-50 text-violet-700 border-violet-100' }] : []),
                ].map(s => (
                    <div key={s.label} className={`${s.bg} border rounded-xl p-3.5`}>
                        <p className="text-sm font-semibold flex items-center gap-1.5">{s.icon} {s.label}</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{formatNumber(s.value)}</p>
                    </div>
                ))}
            </div>

            {/* Tabs & Controls */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 gap-0.5">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const activeColors: Record<string, string> = { blue: 'bg-blue-600 text-white', amber: 'bg-amber-500 text-white', purple: 'bg-violet-600 text-white' };
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? activeColors[tab.color] : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder={activeTab === 'unused_cards' ? 'رقم البطاقة...' : 'بحث بالاسم أو الهوية...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="input-field pr-9"
                        />
                    </div>
                    <button
                        onClick={exportToExcel}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-[10px] flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors shadow-sm"
                    >
                        <FileDown className="w-4 h-4" />
                        تصدير
                    </button>
                </div>
            </div>

            {/* Data Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="data-table min-w-full text-right">
                        <thead>
                            {activeTab !== 'unused_cards' ? (
                                <tr>
                                    <th className="cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('name')}>
                                        اسم المستفيد <SortIcon field="name" />
                                    </th>
                                    <th>رقم الهوية</th>
                                    <th>رقم الجوال</th>
                                    <th className="text-center">الكمية</th>
                                    {activeTab === 'received' && (
                                        <>
                                            <th className="cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('received_at')}>
                                                وقت الاستلام <SortIcon field="received_at" />
                                            </th>
                                            <th>الموزع</th>
                                            {projectConfig?.requires_cards !== false && <th>أرقام البطاقات</th>}
                                        </>
                                    )}
                                </tr>
                            ) : (
                                <tr>
                                    <th className="cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('card_number')}>
                                        رقم البطاقة <SortIcon field="card_number" />
                                    </th>
                                    <th>الفئة/القيمة</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-14 text-center">
                                        <Spinner size="md" className="text-blue-500 mx-auto mb-2" />
                                        <p className="text-slate-500 text-sm mt-2">جاري جلب البيانات...</p>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-14 text-center text-slate-400 text-sm">
                                        لا توجد بيانات متاحة
                                    </td>
                                </tr>
                            ) : filteredData.map(row => (
                                <tr key={row.id}>
                                    {activeTab !== 'unused_cards' ? (
                                        <>
                                            <td className="font-semibold text-slate-900">{row.name}</td>
                                            <td className="font-mono text-slate-500">{row.identity_number}</td>
                                            <td dir="ltr" className="text-slate-500">{row.phone_number || '—'}</td>
                                            <td className="text-center">
                                                <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold ${activeTab === 'received' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                                                    {row.assigned_cards_count || projectConfig?.cards_per_beneficiary || '—'}
                                                </span>
                                            </td>
                                            {activeTab === 'received' && (
                                                <>
                                                    <td className="text-xs text-slate-500" dir="ltr">
                                                        {row.received_at ? new Date(row.received_at).toLocaleString('ar-SA') : '—'}
                                                    </td>
                                                    <td className="text-xs font-semibold text-blue-700">{row.distributed_by_name || 'المدير'}</td>
                                                    {projectConfig?.requires_cards !== false && (
                                                        <td className="font-mono text-xs text-slate-700 max-w-[180px] truncate" title={row.card_numbers}>
                                                            {row.card_numbers || '—'}
                                                        </td>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <td className="font-mono font-bold text-violet-700 text-base">{row.card_number}</td>
                                            <td className="text-slate-500">{row.value || '—'}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 text-sm text-slate-500 flex justify-between items-center">
                    <span>إجمالي النتائج: <b className="text-slate-700">{formatNumber(filteredData.length)}</b></span>
                </div>
            </div>
        </div>
    );
}
