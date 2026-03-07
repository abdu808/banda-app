'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SEARCH_DEBOUNCE_MS, MAX_CARDS_PER_INPUT } from '@/lib/constants';
import toast from 'react-hot-toast';

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

interface ProjectConfig {
    id: string;
    name: string;
    status: string;
    requires_cards: boolean;
    cards_per_beneficiary: number;
}

export function useHandover(projectId: string | string[]) {
    const pid = Array.isArray(projectId) ? projectId[0] : projectId;

    const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
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
    const [sessionCount, setSessionCount] = useState(0);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // تحميل البيانات الأولية
    const initData = useCallback(async () => {
        const { data: proj } = await supabase.from('projects').select('*').eq('id', pid).single();
        setProjectConfig(proj);

        const [{ count: total }, { count: received }] = await Promise.all([
            supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', pid),
            supabase.from('beneficiaries').select('*', { count: 'exact', head: true }).eq('project_id', pid).eq('status', 'received'),
        ]);
        setStats({ total: total || 0, received: received || 0 });

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('name, email').eq('id', user.id).single();
            setCurrentUser({ id: user.id, name: profile?.name || profile?.email || user.email || '' });
        }
    }, [pid]);

    useEffect(() => { initData(); }, [initData]);

    // بحث مع debounce
    useEffect(() => {
        if (searchQuery.length < 2) { setBeneficiaries([]); return; }
        const search = async () => {
            const { data, error } = await supabase
                .from('beneficiaries')
                .select('id, name, identity_number, phone_number, status, assigned_cards_count')
                .eq('project_id', pid)
                .or(`name.ilike.%${searchQuery}%,identity_number.ilike.${searchQuery}%,phone_number.ilike.${searchQuery}%`)
                .limit(10);
            if (!error && data) setBeneficiaries(data);
        };
        const delay = setTimeout(search, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(delay);
    }, [searchQuery, pid]);

    const resetForm = useCallback(() => {
        setSelectedBeni(null);
        setSearchQuery('');
        setScannedCards([]);
        setFieldNotes('');
        setProxyName('');
        setBeneficiaries([]);
        searchInputRef.current?.focus();
    }, []);

    const dismissOverlay = useCallback(() => {
        setSuccessOverlay(null);
        searchInputRef.current?.focus();
    }, []);

    const cancelSelection = useCallback(() => {
        setSelectedBeni(null);
        setSearchQuery('');
        setScannedCards([]);
        setFieldNotes('');
        setProxyName('');
        setBeneficiaries([]);
        setTimeout(() => searchInputRef.current?.focus(), 0);
    }, []);

    const selectBeneficiary = useCallback((beni: Beneficiary) => {
        if (beni.status === 'received') {
            toast.error('هذا المستفيد استلم مخصصاته مسبقاً');
            return;
        }
        setSelectedBeni(beni);
        if (projectConfig?.requires_cards !== false) {
            let count = Number(beni.assigned_cards_count ?? projectConfig?.cards_per_beneficiary ?? 2);
            if (isNaN(count) || count < 1) count = 1;
            if (count > MAX_CARDS_PER_INPUT) {
                toast.error(`تحذير: عدد بطاقات خاطئ — تم تقليصه لـ ${MAX_CARDS_PER_INPUT}`);
                count = MAX_CARDS_PER_INPUT;
            }
            setScannedCards(Array(count).fill(''));
            inputRefs.current = Array(count).fill(null);
        }
    }, [projectConfig]);

    const handleCardChange = useCallback((index: number, value: string) => {
        setScannedCards(prev => {
            const newCards = [...prev];
            newCards[index] = value;
            return newCards;
        });
    }, []);

    const handleHandover = useCallback(async (e?: React.FormEvent) => {
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
                const filledCards = scannedCards.filter(c => c.trim());
                const { data: cards, error: cardsError } = await supabase
                    .from('cards')
                    .select('id, card_number, status')
                    .eq('project_id', pid)
                    .in('card_number', filledCards);

                if (cardsError) throw new Error('حدث خطأ أثناء فحص البطاقات');
                if (!cards || cards.length !== filledCards.length) throw new Error('إحدى البطاقات غير موجودة في النظام');

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
            setSessionCount(prev => prev + 1);
            resetForm();
            setTimeout(() => setSuccessOverlay(null), 1200);

        } catch (err: any) {
            toast.error(err.message || 'فشلت عملية التسليم');
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedBeni, projectConfig, scannedCards, fieldNotes, proxyName, currentUser, pid, resetForm]);

    const isSubmitDisabled = () => {
        if (isSubmitting) return true;
        if (projectConfig?.requires_cards !== false) {
            return scannedCards.length === 0 || scannedCards.some(card => card.trim() === '');
        }
        return false;
    };

    const pct = stats.total > 0 ? Math.round((stats.received / stats.total) * 100) : 0;

    return {
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
    };
}
