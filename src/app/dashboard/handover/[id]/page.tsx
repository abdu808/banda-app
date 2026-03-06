'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Search, UserCheck, CreditCard, CheckCircle2, AlertCircle, ArrowRight, CheckCheck } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Beneficiary {
    id: string;
    name: string;
    identity_number: string;
    phone_number: string | null;
    status: string;
    assigned_cards_count: number | null;
}

interface SuccessOverlay {
    name: string;
    cards: string[];
}

export default function HandoverPage() {
    const { id: projectId } = useParams();
    const router = useRouter();

    const [projectConfig, setProjectConfig] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [selectedBeni, setSelectedBeni] = useState<Beneficiary | null>(null);

    const [scannedCards, setScannedCards] = useState<string[]>([]);
    const [fieldNotes, setFieldNotes] = useState('');
    const [proxyName, setProxyName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [stats, setStats] = useState({ total: 0, received: 0 });
    const [successOverlay, setSuccessOverlay] = useState<SuccessOverlay | null>(null);
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const initData = useCallback(async () => {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
        setProjectConfig(proj);
        const { count: total } = await supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
        const { count: received } = await supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'received');
        setStats({ total: total || 0, received: received || 0 });

        // Get current logged-in user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('name, email').eq('id', user.id).single();
            setCurrentUser({ id: user.id, name: profile?.name || profile?.email || user.email || '' });
        }
    }, [projectId]);

    useEffect(() => { initData(); }, [initData]);

    // Debounced search
    useEffect(() => {
        if (searchQuery.length < 2) { setBeneficiaries([]); return; }
        const searchBeni = async () => {
            const { data, error } = await supabase
                .from('beneficiaries')
                .select('id, name, identity_number, phone_number, status, assigned_cards_count')
                .eq('project_id', projectId)
                .or(`name.ilike.%${searchQuery}%,identity_number.ilike.${searchQuery}%,phone_number.ilike.${searchQuery}%`)
                .limit(8);
            if (!error && data) setBeneficiaries(data);
        };
        const delay = setTimeout(searchBeni, 350);
        return () => clearTimeout(delay);
    }, [searchQuery, projectId]);

    const resetForm = useCallback(() => {
        setSelectedBeni(null);
        setSearchQuery('');
        setScannedCards([]);
        setFieldNotes('');
        setProxyName('');
        setBeneficiaries([]);
        setTimeout(() => searchInputRef.current?.focus(), 100);
    }, []);

    const handleCardChange = (index: number, value: string) => {
        const newCards = [...scannedCards];
        newCards[index] = value;
        setScannedCards(newCards);
    };

    const handleHandover = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedBeni) return;

        const requiresCards = projectConfig?.requires_cards !== false;

        if (requiresCards) {
            const filledCards = scannedCards.filter(c => c.trim() !== '');
            const uniqueCards = new Set(filledCards);
            if (uniqueCards.size !== filledCards.length) {
                toast.error('لا يمكن إدخال نفس البطاقة مرتين');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const usedCardNums: string[] = [];

            if (requiresCards) {
                const { data: cards, error: cardsError } = await supabase
                    .from('cards')
                    .select('id, card_number, status')
                    .eq('project_id', projectId)
                    .in('card_number', scannedCards);

                if (cardsError) throw new Error('حدث خطأ أثناء فحص البطاقات');
                if (!cards || cards.length !== scannedCards.length) throw new Error('إحدى البطاقات غير موجودة في النظام');

                const unavailable = cards.find(c => c.status !== 'available');
                if (unavailable) throw new Error(`البطاقة ${unavailable.card_number} غير متاحة (تم تسليمها سابقاً)`);

                const cardIds = cards.map(c => c.id);
                cards.forEach(c => usedCardNums.push(c.card_number));

                const { error: updateCardsError } = await supabase
                    .from('cards')
                    .update({ status: 'used', assigned_to: selectedBeni.id, assigned_at: new Date().toISOString() })
                    .in('id', cardIds);

                if (updateCardsError) throw new Error('حدث خطأ في تحديث البطاقات');
            }

            const { error: updateBeniError } = await supabase
                .from('beneficiaries')
                .update({
                    status: 'received',
                    received_at: new Date().toISOString(),
                    field_notes: fieldNotes.trim() || null,
                    proxy_name: proxyName.trim() || null,
                    distributed_by_id: currentUser?.id || null,
                    distributed_by_name: currentUser?.name || null,
                })
                .eq('id', selectedBeni.id);

            if (updateBeniError) throw new Error('حدث خطأ في تحديث حالة المستفيد');

            setSuccessOverlay({ name: selectedBeni.name, cards: usedCardNums });
            setStats(prev => ({ ...prev, received: prev.received + 1 }));
            resetForm();
            setTimeout(() => setSuccessOverlay(null), 3500);

        } catch (err: any) {
            toast.error(err.message || 'فشلت عملية التسليم');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isSubmitDisabled = () => {
        if (isSubmitting) return true;
        if (projectConfig?.requires_cards !== false) {
            return scannedCards.length === 0 || scannedCards.some(card => card.trim() === '');
        }
        return false;
    };

    const pct = stats.total > 0 ? Math.round((stats.received / stats.total) * 100) : 0;

    return (
        <div className="max-w-4xl mx-auto space-y-5 pb-20">
            <Toaster position="top-center" />

            {/* Success Overlay */}
            {successOverlay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-scale-in">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 relative">
                            <CheckCheck className="w-10 h-10 text-green-600" />
                            <div className="absolute inset-0 rounded-full border-4 border-green-200 animate-ping opacity-30" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">تم التسليم بنجاح! ✅</h2>
                        <p className="text-blue-700 font-bold text-lg mb-3">{successOverlay.name}</p>
                        {successOverlay.cards.length > 0 && (
                            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 font-mono">
                                {successOverlay.cards.join(' · ')}
                            </div>
                        )}
                        <p className="text-gray-400 text-sm mt-4">جاري الانتقال للتسليم التالي...</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex bg-white p-5 rounded-2xl shadow-sm border border-gray-100 items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:bg-gray-100 p-2 rounded-xl transition-colors">
                        <ArrowRight className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            تسليم مخصصات: <span className="text-blue-600">{projectConfig?.name || '...'}</span>
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {projectConfig?.requires_cards !== false
                                ? 'يتم التحقق من ربط البطاقات قبل التسليم'
                                : `المشروع لا يتطلب بطاقات`}
                        </p>
                    </div>
                </div>
                {projectConfig && projectConfig.status !== 'active' && (
                    <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold text-sm border border-red-200 flex-shrink-0">
                        التسليم متوقف
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex justify-between text-sm font-medium mb-2.5">
                    <span className="text-gray-500">نسبة الإنجاز</span>
                    <span className="text-gray-900 font-bold">{stats.received.toLocaleString('ar-SA')} / {stats.total.toLocaleString('ar-SA')} ({pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-3 rounded-full transition-all duration-700 ease-out ${pct === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            {/* Search / Handover Form */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                {!selectedBeni ? (
                    <div className="space-y-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                ref={searchInputRef}
                                autoFocus
                                type="text"
                                className="block w-full pl-4 pr-11 py-3.5 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white text-base transition"
                                placeholder="ابحث بالاسم، رقم الهوية، أو الجوال..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {beneficiaries.length > 0 && (
                            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white shadow-sm max-h-80 overflow-y-auto">
                                {beneficiaries.map(beni => (
                                    <div
                                        key={beni.id}
                                        onClick={() => {
                                            if (beni.status === 'pending') {
                                                setSelectedBeni(beni);
                                                if (projectConfig?.requires_cards !== false) {
                                                    let count = Number(beni.assigned_cards_count ?? projectConfig?.cards_per_beneficiary ?? 2);
                                                    if (isNaN(count) || count < 1) count = 1;
                                                    if (count > 50) { toast.error('تحذير: عدد بطاقات خاطئ — تم تقليصه لـ 50'); count = 50; }
                                                    setScannedCards(Array(count).fill(''));
                                                    inputRefs.current = Array(count).fill(null);
                                                }
                                            } else {
                                                toast.error('هذا المستفيد استلم مخصصاته مسبقاً');
                                            }
                                        }}
                                        className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${beni.status === 'received' ? 'opacity-60 bg-gray-50 cursor-not-allowed' : 'hover:bg-blue-50/60'}`}
                                    >
                                        <div>
                                            <p className="font-bold text-gray-900">{beni.name}</p>
                                            <div className="text-sm text-gray-500 mt-0.5 flex gap-3">
                                                <span>الهوية: <strong className="text-gray-700">{beni.identity_number}</strong></span>
                                                {beni.phone_number && <span dir="ltr">{beni.phone_number}</span>}
                                            </div>
                                        </div>
                                        <div>
                                            {beni.status === 'received' ? (
                                                <span className="text-green-700 flex items-center gap-1 text-xs font-semibold bg-green-100 px-3 py-1 rounded-full">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> مستلم
                                                </span>
                                            ) : (
                                                <span className="text-blue-700 text-xs font-semibold bg-blue-100 px-3 py-1 rounded-full">جاهز</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {searchQuery.length >= 2 && beneficiaries.length === 0 && (
                            <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                                <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                                <p>لا يوجد مستفيد مطابق للبحث</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-7 flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">المستفيد المحدد</p>
                                <h3 className="font-black text-blue-900 text-xl">{selectedBeni.name}</h3>
                                <div className="flex gap-4 text-sm text-blue-700 mt-1.5">
                                    <span>الهوية: <strong>{selectedBeni.identity_number}</strong></span>
                                    {selectedBeni.phone_number && <span dir="ltr">{selectedBeni.phone_number}</span>}
                                </div>
                            </div>
                            <button onClick={resetForm} className="text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors">
                                تغيير
                            </button>
                        </div>

                        <form onSubmit={handleHandover} className="space-y-6">
                            {projectConfig?.requires_cards !== false && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-800 text-sm border-b border-gray-100 pb-2.5 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-blue-500" />
                                        أرقام البطاقات المطلوبة ({scannedCards.length} بطاقة)
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {scannedCards.map((card, index) => (
                                            <div key={index}>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5">البطاقة رقم {index + 1}</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                        <CreditCard className="h-5 w-5 text-gray-300" />
                                                    </div>
                                                    <input
                                                        ref={el => { inputRefs.current[index] = el; }}
                                                        autoFocus={index === 0}
                                                        type="text"
                                                        required
                                                        className={`block w-full pl-4 pr-10 py-3.5 border rounded-xl font-mono text-center text-xl font-bold bg-white tracking-widest transition h-14 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${card.trim() ? 'border-green-400 bg-green-50 text-green-800' : 'border-gray-300'}`}
                                                        placeholder="امسح الباركود"
                                                        value={card}
                                                        onChange={e => handleCardChange(index, e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' && card.trim()) {
                                                                e.preventDefault();
                                                                if (index < scannedCards.length - 1) {
                                                                    inputRefs.current[index + 1]?.focus();
                                                                } else {
                                                                    const allFilled = scannedCards.every((c, i) => i === index ? card.trim() : c.trim());
                                                                    if (allFilled) handleHandover();
                                                                }
                                                            }
                                                        }}
                                                        dir="ltr"
                                                    />
                                                    {card.trim() && (
                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 pt-2 border-t border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5" htmlFor="proxyName">
                                            <UserCheck className="w-3.5 h-3.5 inline ml-1 text-gray-400" />
                                            استلام نيابي / تفويض (اختياري)
                                        </label>
                                        <input id="proxyName" type="text"
                                            className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-gray-50 transition"
                                            placeholder="اسم المستلم الفعلي إن وُجد"
                                            value={proxyName}
                                            onChange={e => setProxyName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5" htmlFor="fieldNotes">
                                            ملاحظات ميدانية (اختياري)
                                        </label>
                                        <input id="fieldNotes" type="text"
                                            className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-gray-50 transition"
                                            placeholder="أي ملاحظة حول عملية التسليم"
                                            value={fieldNotes}
                                            onChange={e => setFieldNotes(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitDisabled()}
                                className="w-full h-14 mt-2 rounded-xl text-base font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-200"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        تأكيد التسليم — {selectedBeni.name}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
