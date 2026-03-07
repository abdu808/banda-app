'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, CreditCard, User, Calendar, Folder, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

interface TrackingData {
    card_number: string;
    status: string;
    value: number;
    assigned_at: string | null;
    projects: { name: string } | null;
    beneficiaries: { name: string; identity_number: string; phone_number: string | null } | null;
}

export default function TrackingPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TrackingData | null>(null);
    const [searched, setSearched] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setLoading(true);
        setSearched(true);
        setResult(null);
        const { data } = await supabase
            .from('cards')
            .select('card_number, status, value, assigned_at, projects ( name ), beneficiaries ( name, identity_number, phone_number )')
            .eq('card_number', searchQuery.trim())
            .single();
        if (data) setResult(data as any);
        setLoading(false);
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">الاستعلام والتتبع</h1>
                <p className="text-slate-500 mt-0.5 text-sm">ابحث برقم البطاقة لمعرفة حالة تسليمها وهوية المستفيد</p>
            </div>

            <form onSubmit={handleSearch} className="relative flex gap-2">
                <div className="relative flex-1">
                    <Search className="h-5 w-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        required
                        placeholder="أدخل رقم البطاقة..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="input-field pr-10 py-3 text-center font-mono tracking-widest text-lg"
                        dir="ltr"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || !searchQuery.trim()}
                    className="bg-blue-600 text-white px-6 py-3 rounded-[10px] font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 flex-shrink-0"
                >
                    {loading ? <Spinner size="sm" /> : 'تتبع'}
                </button>
            </form>

            {searched && !loading && !result && (
                <div className="bg-red-50 text-red-700 p-5 rounded-xl text-center border border-red-100 flex flex-col items-center gap-2">
                    <AlertCircle className="w-8 h-8 text-red-400" />
                    <p className="font-bold">لم يتم العثور على البطاقة</p>
                    <p className="text-sm text-red-500">تأكد من رقم البطاقة، قد لا تكون مسجلة في قاعدة البيانات.</p>
                </div>
            )}

            {result && (
                <div className="card overflow-hidden animate-scale-in">
                    <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800 font-mono font-bold text-lg">
                            <CreditCard className="w-5 h-5 text-slate-400" />
                            {result.card_number}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${result.status === 'used' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {result.status === 'used' ? 'تم التسليم' : 'متاحة (لم تُسلم)'}
                        </span>
                    </div>

                    <div className="p-5 space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 flex-shrink-0">
                                <Folder className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">المشروع التابعة له</p>
                                <p className="font-bold text-slate-900">{result.projects?.name || 'غير معروف'}</p>
                                {result.value > 0 && <p className="text-xs text-slate-400 mt-0.5">قيمة البطاقة: {result.value} ريال</p>}
                            </div>
                        </div>

                        {result.status === 'used' && result.beneficiaries && (
                            <>
                                <div className="border-t border-slate-100" />
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 flex-shrink-0">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-600 mb-0.5 uppercase tracking-wide">المستفيد المسجل</p>
                                        <p className="font-bold text-slate-900 text-lg">{result.beneficiaries.name}</p>
                                        <p className="text-sm text-slate-500 font-mono mt-0.5">
                                            هوية: {result.beneficiaries.identity_number}
                                            {result.beneficiaries.phone_number && ` | جوال: ${result.beneficiaries.phone_number}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 flex-shrink-0">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">تاريخ التسليم</p>
                                        <p className="text-slate-800 font-medium">
                                            {result.assigned_at ? new Date(result.assigned_at).toLocaleString('en-GB') : 'غير متوفر'}
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
