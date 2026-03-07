'use client';

/**
 * حارس الصلاحيات — /dashboard/project/*
 * يحمي جميع صفحات إعدادات المشاريع ويسمح فقط للمديرين.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

export default function AdminOnlyLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [status, setStatus] = useState<'checking' | 'authorized' | 'denied'>('checking');

    useEffect(() => {
        const check = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profile?.role === 'admin') {
                setStatus('authorized');
            } else {
                setStatus('denied');
                router.replace('/dashboard/distributor');
            }
        };
        check();
    }, [router]);

    if (status === 'checking') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Spinner size="lg" className="text-blue-500" />
            </div>
        );
    }

    if (status === 'denied') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="card p-10 text-center max-w-sm">
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-7 h-7 text-red-500" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mb-1">غير مصرح بالوصول</h2>
                    <p className="text-slate-500 text-sm">هذه الصفحة للمديرين فقط. جاري التحويل…</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
