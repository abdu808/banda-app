'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, CreditCard, User, Calendar, Folder } from 'lucide-react';

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

        const { data, error } = await supabase
            .from('cards')
            .select(`
        card_number, status, value, assigned_at,
        projects ( name ),
        beneficiaries ( name, identity_number, phone_number )
      `)
            .eq('card_number', searchQuery)
            .single();

        if (data) {
            setResult(data as any);
        }

        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">الاستعلام والتتبع</h1>
                <p className="text-gray-500">ابحث برقم البطاقة لمعرفة حالة تسليمها وهوية المستفيد</p>
            </div>

            <form onSubmit={handleSearch} className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <Search className="h-6 w-6 text-gray-400" />
                </div>
                <input
                    type="text"
                    required
                    placeholder="أدخل رقم البطاقة هنا..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-3 pr-14 py-4 border-2 border-gray-200 rounded-2xl focus:ring-blue-500 focus:border-blue-500 sm:text-lg text-center font-mono shadow-sm transition-colors"
                    dir="ltr"
                />
                <button
                    type="submit"
                    disabled={loading || !searchQuery}
                    className="absolute left-2 top-2 bottom-2 bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? 'بحث...' : 'تتبع'}
                </button>
            </form>

            {searched && !loading && !result && (
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl text-center border border-red-100">
                    <p className="font-bold text-lg mb-1">لم يتم العثور على البطاقة</p>
                    <p className="text-sm">تأكد من رقم البطاقة، قد لا تكون مسجلة في قاعدة البيانات.</p>
                </div>
            )}

            {result && (
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-gray-900 font-mono font-bold text-xl">
                            <CreditCard className="w-6 h-6 text-gray-400" />
                            {result.card_number}
                        </div>
                        <span
                            className={`px-3 py-1 rounded-full text-sm font-bold ${result.status === 'used' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}
                        >
                            {result.status === 'used' ? 'تم التسليم' : 'متاحة (لم تُسلم)'}
                        </span>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-gray-100 rounded-xl text-gray-500">
                                <Folder className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-500 mb-1">المشروع التابعة له</p>
                                <p className="text-lg font-bold text-gray-900">{result.projects?.name || 'غير معروف'}</p>
                                <p className="text-sm text-gray-500">قيمة البطاقة: {result.value} ريال</p>
                            </div>
                        </div>

                        {result.status === 'used' && result.beneficiaries && (
                            <>
                                <div className="w-full h-px bg-gray-100 my-4 border-dashed border-b-2"></div>
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-green-50 rounded-xl text-green-600">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-green-600 mb-1">المستفيد المسجلة باسمه</p>
                                        <p className="text-xl font-bold text-gray-900 mb-1">{result.beneficiaries.name}</p>
                                        <p className="text-sm text-gray-500 font-mono">هوية: {result.beneficiaries.identity_number} {result.beneficiaries.phone_number && `| جوال: ${result.beneficiaries.phone_number}`}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-gray-50 rounded-xl text-gray-400">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-500 mb-1">وقت وتاريخ التسليم</p>
                                        <p className="text-gray-900">{result.assigned_at ? new Date(result.assigned_at).toLocaleString('ar-SA') : 'غير متوفر'}</p>
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
