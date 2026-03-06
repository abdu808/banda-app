'use client';

/**
 * Admin-Only Layout Guard
 * Protects all routes under /dashboard/project/* 
 * Redirects non-admins back to the dashboard main page.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

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

            // Allow if profile role is admin OR if env fallback email matches
            if (profile?.role === 'admin' || user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
                setStatus('authorized');
            } else {
                setStatus('denied');
                // Auto-redirect after 2 seconds
                setTimeout(() => router.push('/dashboard'), 2000);
            }
        };
        check();
    }, [router]);

    if (status === 'checking') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (status === 'denied') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-red-100 max-w-sm animate-scale-in">
                    <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">غير مصرح لك بالوصول</h2>
                    <p className="text-gray-500 text-sm">
                        هذه الصفحة مخصصة للمديرين فقط. سيتم تحويلك تلقائياً...
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
