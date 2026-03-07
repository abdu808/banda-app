'use client';

import { useEffect } from 'react';
import { Search, UserCheck, CreditCard, CheckCircle2, AlertCircle, CheckCheck } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useHandover } from '@/hooks/useHandover';
import { formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface HandoverViewProps {
    projectId: string | string[];
    backHref: string;
}

export function HandoverView({ projectId, backHref }: HandoverViewProps) {
    const {
        projectConfig,
        searchQuery, setSearchQuery,
        beneficiaries,
        selectedBeni,
        scannedCards,
        fieldNotes, setFieldNotes,
        proxyName, setProxyName,
        isSubmitting,
        stats, pct,
        successOverlay,
        sessionCount,
        searchInputRef,
        inputRefs,
        resetForm,
        dismissOverlay,
        cancelSelection,
        selectBeneficiary,
        handleCardChange,
        handleHandover,
        isSubmitDisabled,
    } = useHandover(projectId);

    // مختصرات لوحة المفاتيح
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // أي مفتاح أثناء نافذة النجاح → إغلاق فوري
            if (successOverlay) {
                e.preventDefault();
                dismissOverlay();
                return;
            }
            // Escape مع مستفيد محدد وغير قيد الإرسال → إلغاء الاختيار
            if (e.key === 'Escape' && selectedBeni !== null && !isSubmitting) {
                e.preventDefault();
                cancelSelection();
                return;
            }
            // / → تركيز مربع البحث
            if (e.key === '/' && !selectedBeni) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [successOverlay, selectedBeni, isSubmitting, dismissOverlay, cancelSelection, searchInputRef]);

    // صوت النجاح عند ظهور overlay
    useEffect(() => {
        if (!successOverlay) return;
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.35);
        } catch { /* صوت غير متاح */ }
    }, [successOverlay]);

    return (
        <div className="max-w-3xl mx-auto space-y-5 pb-16">
            <Toaster position="bottom-center" toastOptions={{ duration: 4000 }} />

            {/* Success Overlay */}
            {successOverlay && (
                <div
                    className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4 animate-fade-in cursor-pointer"
                    onClick={dismissOverlay}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 relative">
                            <CheckCheck className="w-10 h-10 text-emerald-600" />
                            <div className="absolute inset-0 rounded-full border-4 border-emerald-200 animate-ping opacity-30" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-1">تم التسليم بنجاح</h2>
                        <p className="text-blue-700 font-bold text-lg mb-3">{successOverlay.name}</p>
                        {successOverlay.cards.length > 0 && (
                            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 font-mono border border-slate-100">
                                {successOverlay.cards.join(' · ')}
                            </div>
                        )}
                        <p className="text-slate-400 text-sm mt-4">اضغط أي مفتاح للمتابعة ←</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="card p-4 flex items-center justify-between gap-4">
                <PageHeader
                    title={`تسليم: ${projectConfig?.name || '...'}`}
                    description={projectConfig?.requires_cards !== false ? 'يتم التحقق من البطاقات قبل التسليم' : 'المشروع لا يتطلب بطاقات'}
                    backHref={backHref}
                />
                {projectConfig && projectConfig.status !== 'active' && (
                    <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-semibold text-sm border border-red-200 flex-shrink-0">
                        التسليم متوقف
                    </div>
                )}
            </div>

            {/* Progress */}
            <div className="card p-4">
                <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-slate-500">نسبة الإنجاز</span>
                    <div className="flex items-center gap-3">
                        {sessionCount > 0 && (
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 text-xs">
                                سُلّمت: {formatNumber(sessionCount)}
                            </span>
                        )}
                        <span className="text-slate-800 font-bold">
                            {formatNumber(stats.received)} / {formatNumber(stats.total)} ({pct}%)
                        </span>
                    </div>
                </div>
                <div className="progress-bar h-2.5">
                    <div
                        className={`progress-fill ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            {/* Search / Form */}
            <div className="card p-6">
                {!selectedBeni ? (
                    <div className="space-y-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                ref={searchInputRef}
                                autoFocus
                                type="text"
                                className="input-field pl-4 pr-11 py-3.5 text-base"
                                placeholder="ابحث بالاسم، رقم الهوية، أو الجوال..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const firstPending = beneficiaries.find(b => b.status !== 'received');
                                        if (firstPending) selectBeneficiary(firstPending);
                                    }
                                }}
                            />
                        </div>

                        {beneficiaries.length > 0 && (
                            <div className="border border-slate-200 rounded-xl divide-y divide-slate-50 bg-white shadow-sm max-h-80 overflow-y-auto">
                                {beneficiaries.map(beni => (
                                    <div
                                        key={beni.id}
                                        onClick={() => selectBeneficiary(beni)}
                                        className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                                            beni.status === 'received'
                                                ? 'opacity-50 bg-slate-50 cursor-not-allowed'
                                                : 'hover:bg-blue-50/60 active:bg-blue-50'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-bold text-slate-900">{beni.name}</p>
                                            <div className="text-sm text-slate-500 mt-0.5 flex gap-3">
                                                <span>الهوية: <strong className="text-slate-700">{beni.identity_number}</strong></span>
                                                {beni.phone_number && <span dir="ltr">{beni.phone_number}</span>}
                                            </div>
                                        </div>
                                        {beni.status === 'received' ? (
                                            <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> مستلم
                                            </span>
                                        ) : (
                                            <span className="status-badge bg-blue-50 text-blue-700 border-blue-200 text-xs">جاهز</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {searchQuery.length >= 2 && beneficiaries.length === 0 && (
                            <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
                                <AlertCircle className="w-8 h-8 text-slate-300" />
                                <p className="text-sm">لا يوجد مستفيد مطابق للبحث</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">المستفيد المحدد</p>
                                <h3 className="font-black text-blue-900 text-xl">{selectedBeni.name}</h3>
                                <div className="flex gap-4 text-sm text-blue-700 mt-1.5">
                                    <span>الهوية: <strong>{selectedBeni.identity_number}</strong></span>
                                    {selectedBeni.phone_number && <span dir="ltr">{selectedBeni.phone_number}</span>}
                                </div>
                            </div>
                            <Button variant="secondary" size="sm" onClick={resetForm}>تغيير</Button>
                        </div>

                        <form onSubmit={handleHandover} className="space-y-6">
                            {projectConfig?.requires_cards !== false && (
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-2.5 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-blue-500" />
                                        أرقام البطاقات ({scannedCards.length} بطاقة)
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {scannedCards.map((card, index) => (
                                            <div key={index}>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">البطاقة رقم {index + 1}</label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                        <CreditCard className="h-4 w-4 text-slate-300" />
                                                    </div>
                                                    <input
                                                        ref={el => { inputRefs.current[index] = el; }}
                                                        autoFocus={index === 0}
                                                        type="text"
                                                        required
                                                        className={`block w-full pl-10 pr-9 py-3.5 border rounded-xl font-mono text-center text-xl font-bold tracking-widest transition h-14 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                            card.trim()
                                                                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                                                                : 'border-slate-300 bg-white'
                                                        }`}
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
                                                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 border-t border-slate-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                            <UserCheck className="w-3.5 h-3.5 inline ml-1 text-slate-400" />
                                            استلام نيابي / تفويض (اختياري)
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="اسم المستلم الفعلي إن وُجد"
                                            value={proxyName}
                                            onChange={e => setProxyName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                            ملاحظات ميدانية (اختياري)
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field"
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
                                className="w-full h-14 mt-2 rounded-xl text-base font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-100"
                            >
                                {isSubmitting ? (
                                    <Spinner size="sm" />
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
