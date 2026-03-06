'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Search, FileDown, ArrowUpDown, CheckCircle, Clock, CreditCard, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';

type Tab = 'received' | 'pending' | 'unused_cards';

export default function ComprehensiveReportPage() {
    const { id: projectId } = useParams();
    const router = useRouter();

    const [projectConfig, setProjectConfig] = useState<any>(null);
    const [stats, setStats] = useState({ totalBeni: 0, receivedBeni: 0, pendingBeni: 0, availableCards: 0 });

    // Data States
    const [receivedBeni, setReceivedBeni] = useState<any[]>([]);
    const [pendingBeni, setPendingBeni] = useState<any[]>([]);
    const [unusedCards, setUnusedCards] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('received');

    // Filters and Sorting
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        fetchData();
        // Set default sorting based on tab
        if (activeTab === 'received') setSortField('received_at');
        else if (activeTab === 'unused_cards') setSortField('card_number');
        else setSortField('name');
    }, [projectId, activeTab]);

    const fetchAllRecords = async (table: string, selectDef: string, conditions: Record<string, string>) => {
        let allData: any[] = [];
        let from = 0;
        const step = 999;

        while (true) {
            let query = supabase.from(table).select(selectDef).range(from, from + step);
            for (const [key, value] of Object.entries(conditions)) {
                query = query.eq(key, value);
            }
            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            if (data.length <= step) break; // Reached the end
            from += step + 1;
        }
        return allData;
    };

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Project Config
            const { data: proj, error: projError } = await supabase
                .from('projects')
                .select('name, requires_cards, cards_per_beneficiary')
                .eq('id', projectId)
                .single();

            if (projError) throw projError;
            setProjectConfig(proj);

            // 2. Fetch Received Beneficiaries (with pagination)
            const receivedData = await fetchAllRecords(
                'beneficiaries',
                'id, name, identity_number, phone_number, received_at, assigned_cards_count, distributed_by_name, cards ( card_number )',
                { project_id: projectId as string, status: 'received' }
            );
            const formattedReceived = (receivedData || []).map(b => ({
                ...b,
                card_numbers: b.cards ? b.cards.map((c: any) => c.card_number).join(' ، ') : ''
            }));
            setReceivedBeni(formattedReceived);

            // 3. Fetch Pending Beneficiaries (with pagination)
            const pendingData = await fetchAllRecords(
                'beneficiaries',
                'id, name, identity_number, phone_number, assigned_cards_count',
                { project_id: projectId as string, status: 'pending' }
            );
            setPendingBeni(pendingData || []);

            // 4. Fetch Unused Cards (if project requires cards)
            let availableCardsData: any[] = [];
            if (proj.requires_cards) {
                const cardsData = await fetchAllRecords(
                    'cards',
                    'id, card_number, value',
                    { project_id: projectId as string, status: 'available' }
                );
                availableCardsData = cardsData || [];
                setUnusedCards(availableCardsData);
            }

            // Calculate Stats
            setStats({
                totalBeni: (receivedData?.length || 0) + (pendingData?.length || 0),
                receivedBeni: receivedData?.length || 0,
                pendingBeni: pendingData?.length || 0,
                availableCards: availableCardsData.length
            });

        } catch (error: any) {
            toast.error('حدث خطأ أثناء جلب التقارير');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection(field === 'received_at' ? 'desc' : 'asc');
        }
    };

    const getSortedAndFilteredData = () => {
        let currentData = [];
        if (activeTab === 'received') currentData = receivedBeni;
        else if (activeTab === 'pending') currentData = pendingBeni;
        else currentData = unusedCards;

        return currentData
            .filter(item => {
                if (!searchQuery) return true;
                const lowerQ = searchQuery.toLowerCase();

                if (activeTab === 'unused_cards') {
                    return item.card_number && item.card_number.includes(lowerQ);
                }

                return (
                    (item.name && item.name.toLowerCase().includes(lowerQ)) ||
                    (item.identity_number && item.identity_number.includes(lowerQ)) ||
                    (item.phone_number && item.phone_number.includes(lowerQ)) ||
                    (item.card_numbers && item.card_numbers.includes(lowerQ))
                );
            })
            .sort((a, b) => {
                let comparison = 0;

                if (activeTab === 'unused_cards') {
                    comparison = (a[sortField] || '').localeCompare(b[sortField] || '');
                } else if (sortField === 'received_at' && a.received_at && b.received_at) {
                    comparison = new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
                } else {
                    comparison = (a[sortField] || '').localeCompare(b[sortField] || '', 'ar');
                }

                return sortDirection === 'asc' ? comparison : -comparison;
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
                'تاريخ ووقت الاستلام': b.received_at ? new Date(b.received_at).toLocaleString('ar-SA') : '',
                'الموزع (المسلم)': b.distributed_by_name || 'المدير',
                'الكمية المستلمة': b.assigned_cards_count || projectConfig?.cards_per_beneficiary || 0,
                'أرقام البطاقات': b.card_numbers || 'لا توجد',
            }));
        } else if (activeTab === 'pending') {
            sheetName = 'المتبقين';
            dataToExport = filteredData.map(b => ({
                'اسم المستفيد': b.name,
                'الهوية': b.identity_number,
                'الجوال': b.phone_number || '',
                'الكمية المستحقة': b.assigned_cards_count || projectConfig?.cards_per_beneficiary || 0,
            }));
        } else {
            sheetName = 'البطاقات_المتبقية';
            dataToExport = filteredData.map(c => ({
                'رقم البطاقة': c.card_number,
                'قيمة/فئة البطاقة': c.value || '-',
            }));
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, `تقرير_${sheetName}_${projectConfig?.name || 'مشروع'}.xlsx`);
    };

    const filteredData = getSortedAndFilteredData();

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            <Toaster position="top-center" />

            {/* Header & Stats Overview */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard/reports')} className="text-gray-500 hover:text-gray-900 p-2 bg-gray-50 rounded-lg border shadow-sm">
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">المركز الشامل للتقارير</h1>
                            <p className="text-blue-600 font-medium text-sm mt-1">{projectConfig?.name}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-blue-600 text-sm font-semibold flex items-center gap-1"><Users className="w-4 h-4" /> إجمالي الأسماء</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalBeni}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                        <p className="text-green-700 text-sm font-semibold flex items-center gap-1"><CheckCircle className="w-4 h-4" /> تم التسليم</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{stats.receivedBeni}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <p className="text-orange-700 text-sm font-semibold flex items-center gap-1"><Clock className="w-4 h-4" /> متبقي (لم يستلم)</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingBeni}</p>
                    </div>
                    {projectConfig?.requires_cards !== false && (
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <p className="text-purple-700 text-sm font-semibold flex items-center gap-1"><CreditCard className="w-4 h-4" /> بطاقات غير مستخدمة</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.availableCards}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs & Controls */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 w-full lg:w-auto">
                    <button
                        onClick={() => { setActiveTab('received'); setSearchQuery(''); }}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'received' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        <CheckCircle className="w-4 h-4" /> المستلمين
                    </button>
                    <button
                        onClick={() => { setActiveTab('pending'); setSearchQuery(''); }}
                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'pending' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        <Clock className="w-4 h-4" /> المتبقين للتواصل
                    </button>
                    {projectConfig?.requires_cards !== false && (
                        <button
                            onClick={() => { setActiveTab('unused_cards'); setSearchQuery(''); }}
                            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'unused_cards' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                            <CreditCard className="w-4 h-4" /> البطاقات المتبقية
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                        <input
                            type="text"
                            placeholder={activeTab === 'unused_cards' ? 'ابحث برقم البطاقة...' : 'بحث بالاسم، الهوية، الجوال...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-blue-500 focus:border-blue-500 text-sm shadow-sm"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    </div>
                    <button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors shadow-sm">
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">تصدير (إكسل)</span>
                    </button>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="min-w-full text-sm text-right text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 border-b border-gray-100">
                            {activeTab !== 'unused_cards' ? (
                                <tr>
                                    <th scope="col" className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-100 transition whitespace-nowrap" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">اسم المستفيد <ArrowUpDown className={`w-3 h-3 ${sortField === 'name' ? 'text-blue-600' : 'text-gray-400'}`} /></div>
                                    </th>
                                    <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">رقم الهوية</th>
                                    <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">رقم الجوال</th>
                                    <th scope="col" className="px-6 py-4 font-semibold text-center whitespace-nowrap">الكمية/النصاب</th>

                                    {activeTab === 'received' && (
                                        <>
                                            <th scope="col" className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-100 transition whitespace-nowrap" onClick={() => handleSort('received_at')}>
                                                <div className="flex items-center gap-1">وقت الاستلام <ArrowUpDown className={`w-3 h-3 ${sortField === 'received_at' ? 'text-blue-600' : 'text-gray-400'}`} /></div>
                                            </th>
                                            <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap text-blue-700 bg-blue-50/50">بواسطة (الموزع)</th>
                                            {projectConfig?.requires_cards !== false && (
                                                <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">أرقام البطاقات</th>
                                            )}
                                        </>
                                    )}
                                </tr>
                            ) : (
                                <tr>
                                    <th scope="col" className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('card_number')}>
                                        <div className="flex items-center gap-1">رقم البطاقة <ArrowUpDown className={`w-3 h-3 ${sortField === 'card_number' ? 'text-blue-600' : 'text-gray-400'}`} /></div>
                                    </th>
                                    <th scope="col" className="px-6 py-4 font-semibold">فئة/قيمة البطاقة</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent flex mx-auto rounded-full mb-2"></div>
                                        جاري جلب البيانات...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        لا توجد بيانات متاحة في هذا التقرير.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row) => (
                                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                                        {activeTab !== 'unused_cards' ? (
                                            <>
                                                <td className="px-6 py-4 font-bold text-gray-900 border-l border-gray-100 whitespace-nowrap">{row.name}</td>
                                                <td className="px-6 py-4 font-mono text-gray-500 border-l border-gray-100 whitespace-nowrap">{row.identity_number}</td>
                                                <td className="px-6 py-4 border-l border-gray-100 whitespace-nowrap" dir="ltr">{row.phone_number || '-'}</td>
                                                <td className="px-6 py-4 text-center border-l border-gray-100 whitespace-nowrap">
                                                    <span className={`${activeTab === 'received' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'} font-bold px-3 py-1 rounded-md text-xs`}>
                                                        {row.assigned_cards_count || projectConfig?.cards_per_beneficiary || '-'}
                                                    </span>
                                                </td>
                                                {activeTab === 'received' && (
                                                    <>
                                                        <td className="px-6 py-4 text-xs font-medium text-gray-500 border-l border-gray-100 whitespace-nowrap" dir="ltr">{row.received_at ? new Date(row.received_at).toLocaleString('ar-SA') : '-'}</td>
                                                        <td className="px-6 py-4 text-xs font-bold text-blue-700 bg-blue-50/30 border-l border-gray-100 whitespace-nowrap">{row.distributed_by_name || 'المدير'}</td>
                                                        {projectConfig?.requires_cards !== false && (
                                                            <td className="px-6 py-4 font-mono text-xs text-gray-800 whitespace-nowrap border-l border-gray-100 max-w-[200px] truncate" title={row.card_numbers}>
                                                                {row.card_numbers ? row.card_numbers : <span className="text-gray-400">-</span>}
                                                            </td>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 font-mono font-bold text-purple-700 border-l border-gray-50 text-lg">{row.card_number}</td>
                                                <td className="px-6 py-4 border-l border-gray-50">{row.value || '-'}</td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="bg-gray-50 border-t border-gray-100 p-4 text-sm text-gray-500 flex justify-between items-center">
                    <span>إجمالي النتائج المعروضة: <b>{filteredData.length}</b></span>
                </div>
            </div>
        </div>
    );
}
