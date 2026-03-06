'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Search, FileDown, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';

export default function ProjectLogPage() {
    const { id: projectId } = useParams();
    const router = useRouter();

    const [projectConfig, setProjectConfig] = useState<any>(null);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters and Sorting
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<'received_at' | 'name'>('received_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        fetchData();
    }, [projectId]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch Project Config
            const { data: proj, error: projError } = await supabase
                .from('projects')
                .select('name, requires_cards, cards_per_beneficiary')
                .eq('id', projectId)
                .single();

            if (projError) throw projError;
            setProjectConfig(proj);

            // Fetch Beneficiaries with Cards (only those who received)
            const { data: benis, error: benisError } = await supabase
                .from('beneficiaries')
                .select(`
                    id, name, identity_number, phone_number, received_at, assigned_cards_count,
                    cards ( card_number )
                `)
                .eq('project_id', projectId)
                .eq('status', 'received');

            if (benisError) throw benisError;

            // Format data combining card numbers array
            const formatted = (benis || []).map(b => ({
                ...b,
                card_numbers: b.cards ? b.cards.map((c: any) => c.card_number).join(' ، ') : ''
            }));

            setBeneficiaries(formatted);
        } catch (error: any) {
            toast.error('حدث خطأ أثناء جلب سجل الصرف');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: 'received_at' | 'name') => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc'); // default to newest first or Z-A
        }
    };

    const getSortedAndFilteredData = () => {
        return beneficiaries
            .filter(b => {
                if (!searchQuery) return true;
                const lowerQ = searchQuery.toLowerCase();
                return (
                    (b.name && b.name.toLowerCase().includes(lowerQ)) ||
                    (b.identity_number && b.identity_number.includes(lowerQ)) ||
                    (b.phone_number && b.phone_number.includes(lowerQ)) ||
                    (b.card_numbers && b.card_numbers.includes(lowerQ))
                );
            })
            .sort((a, b) => {
                let comparison = 0;
                if (sortField === 'received_at') {
                    comparison = new Date(a.received_at).getTime() - new Date(b.received_at).getTime();
                } else if (sortField === 'name') {
                    comparison = a.name.localeCompare(b.name, 'ar');
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
    };

    const exportToExcel = () => {
        const dataToExport = getSortedAndFilteredData().map(b => ({
            'اسم المستفيد': b.name,
            'الهوية': b.identity_number,
            'الجوال': b.phone_number || '',
            'تاريخ ووقت الاستلام': new Date(b.received_at).toLocaleString('ar-SA'),
            'عدد البطاقات': b.assigned_cards_count || projectConfig?.cards_per_beneficiary || 0,
            'أرقام البطاقات': b.card_numbers || 'لا توجد',
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل الصرف');
        XLSX.writeFile(workbook, `سجل_الصرف_${projectConfig?.name || 'مشروع'}.xlsx`);
    };

    const filteredData = getSortedAndFilteredData();

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push(`/dashboard/project/${projectId}`)} className="text-gray-500 hover:text-gray-900 p-2 bg-white rounded-lg border shadow-sm">
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">سجل الصرف المفصل</h1>
                        <p className="text-gray-500 text-sm mt-1">{projectConfig?.name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                        <input
                            type="text"
                            placeholder="بحث (اسم، هوية، بطاقة)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    </div>
                    <button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors shadow-sm">
                        <FileDown className="w-4 h-4" /> تصدير
                    </button>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="min-w-full text-sm text-right text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 border-b border-gray-100">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-1">
                                        اسم المستفيد
                                        <ArrowUpDown className={`w-3 h-3 ${sortField === 'name' ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                </th>
                                <th scope="col" className="px-6 py-4 font-semibold">رقم الهوية</th>
                                <th scope="col" className="px-6 py-4 font-semibold">رقم الجوال</th>
                                <th scope="col" className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-100 transition" onClick={() => handleSort('received_at')}>
                                    <div className="flex items-center gap-1">
                                        وقت الاستلام
                                        <ArrowUpDown className={`w-3 h-3 ${sortField === 'received_at' ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                </th>
                                <th scope="col" className="px-6 py-4 font-semibold text-center">الكمية</th>
                                {projectConfig?.requires_cards !== false && (
                                    <th scope="col" className="px-6 py-4 font-semibold">أرقام البطاقات</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent flex mx-auto rounded-full mb-2"></div>
                                        جاري التحميل...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        لا توجد بيانات مطابقة للبحث أو لم يتم تسليم أحد بعد.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row) => (
                                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 border-l border-gray-50">{row.name}</td>
                                        <td className="px-6 py-4 font-mono text-gray-500 border-l border-gray-50">{row.identity_number}</td>
                                        <td className="px-6 py-4 border-l border-gray-50" dir="ltr">{row.phone_number || '-'}</td>
                                        <td className="px-6 py-4 text-xs border-l border-gray-50" dir="ltr">{new Date(row.received_at).toLocaleString('ar-SA')}</td>
                                        <td className="px-6 py-4 text-center border-l border-gray-50">
                                            <span className="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded-md text-xs">
                                                {row.assigned_cards_count || projectConfig?.cards_per_beneficiary || '-'}
                                            </span>
                                        </td>
                                        {projectConfig?.requires_cards !== false && (
                                            <td className="px-6 py-4 font-mono text-xs text-gray-600 whitespace-nowrap">
                                                {row.card_numbers ? row.card_numbers : <span className="text-gray-400">-</span>}
                                            </td>
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
