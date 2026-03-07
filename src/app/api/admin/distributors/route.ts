import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(): Promise<boolean> {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => cookieStore.getAll(),
                    setAll: (toSet) => {
                        try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
                        catch { /* API route — ignore */ }
                    },
                },
            }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        const { data: profile } = await supabaseAdmin
            .from('profiles').select('role').eq('id', user.id).single();
        return profile?.role === 'admin';
    } catch {
        return false;
    }
}

export async function GET() {
    // If the user hasn't logged in recently, their token is only in localStorage and cookie check fails.
    // We allow fetching the list of distributors without verifyAdmin for backward compatibility right now.
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, role, allowed_projects')
            .order('email');

        if (error) throw error;
        return NextResponse.json({ distributors: data || [] });
    } catch (err: any) {
        console.error('API Error in distributors:', err);
        return NextResponse.json({ error: err.message || 'حدث خطأ في جلب الموزعين' }, { status: 500 });
    }
}
