'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { Search, FileDown, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import { formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';

export default function ProjectLogPage() {
    const { id: projectId } = useParams();

    const [projectConfig, setProjectConfig] = useState<any>(null);
    const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<'received_at' | 'name'>('received_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    useEffect(() => { fetchData(); }, [projectId]);

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

            const { data: benis, error: benisError } = await supabase
                .from('beneficiaries')
                .select('id, name, identity_number, phone_number, received_at, assigned_cards_count, cards ( card_number )')
                .eq('project_id', projectId)
                .eq('status', 'received');
            if (benisError) throw benisError;

            setBeneficiaries((benis || []).map(b => ({
                ...b,
                card_numbers: b.cards ? b.cards.map((c: any) => c.card_number).join(' ، ') : ''
            })));
        } catch {
            toast.error('حدث خطأ أثناء جلب سجل الصرف');
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: 'received_at' | 'name') => {
        if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDirection('desc'); }
    };

    const getSortedAndFilteredData = () => {
        return beneficiaries
            .filter(b => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (b.name && b.name.toLowerCase().includes(q)) || (b.identity_number && b.identity_number.includes(q)) || (b.phone_number && b.phone_number.includes(q)) || (b.card_numbers && b.card_numbers.includes(q));
            })
            .sort((a, b) => {
                let cmp = sortField === 'received_at'
                    ? new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
                    : a.name.localeCompare(b.name, 'ar');
                return sortDirection === 'asc' ? cmp : -cmp;
            });
    };

    const exportToExcel = () => {
        const dataToExport = getSortedAndFilteredData().map(b => ({
            'اسم المستفيد': b.name,
            'الهوية': b.identity_number,
            'الجوال': b.phone_number || '',
            'تاريخ الاستلام': new Date(b.received_at).toLocaleString('ar-SA'),
            'عدد البطاقات': b.assigned_cards_count || projectConfig?.cards_per_beneficiary || 0,
            'أرقام البطاقات': b.card_numbers || 'لا توجد',
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'سجل الصرف');
        XLSX.writeFile(wb, `سجل_الصرف_${projectConfig?.name || 'مشروع'}.xlsx`);
    };

    const filteredData = getSortedAndFilteredData();

    const SortIcon = ({ field }: { field: string }) => (
        <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sortField === field ? 'text-blue-600' : 'text-slate-300'}`} />
    );

    return (
        <div className="space-y-5 pb-10">
            <Toaster position="top-center" />

            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
                <PageHeader
                    title="سجل الصرف المفصل"
                    description={projectConfig?.name}
                    backHref={`/dashboard/project/${projectId}`}
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="بحث بالاسم أو الهوية..."
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

            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="data-table min-w-full text-right">
                        <thead>
                            <tr>
                                <th className="cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('name')}>
                                    اسم المستفيد <SortIcon field="name" />
                                </th>
                                <th>رقم الهوية</th>
                                <th>رقم الجوال</th>
                                <th className="cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('received_at')}>
                                    وقت الاستلام <SortIcon field="received_at" />
                                </th>
                                <th className="text-center">الكمية</th>
                                {projectConfig?.requires_cards !== false && <th>أرقام البطاقات</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-14 text-center">
                                        <Spinner size="md" className="text-blue-500 mx-auto mb-2" />
                                        <p className="text-slate-500 text-sm mt-2">جاري التحميل...</p>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-14 text-center text-slate-400 text-sm">
                                        لا توجد بيانات مطابقة أو لم يتم تسليم أحد بعد.
                                    </td>
                                </tr>
                            ) : filteredData.map(row => (
                                <tr key={row.id}>
                                    <td className="font-semibold text-slate-900">{row.name}</td>
                                    <td className="font-mono text-slate-500">{row.identity_number}</td>
                                    <td dir="ltr" className="text-slate-500">{row.phone_number || '—'}</td>
                                    <td className="text-xs text-slate-500" dir="ltr">
                                        {new Date(row.received_at).toLocaleString('ar-SA')}
                                    </td>
                                    <td className="text-center">
                                        <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800">
                                            {row.assigned_cards_count || projectConfig?.cards_per_beneficiary || '—'}
                                        </span>
                                    </td>
                                    {projectConfig?.requires_cards !== false && (
                                        <td className="font-mono text-xs text-slate-700 whitespace-nowrap">
                                            {row.card_numbers || '—'}
                                        </td>
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
