import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(req: NextRequest) {
    if (!(await verifyAdmin())) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    try {
        const { userId, projectId } = await req.json();
        if (!userId || !projectId) {
            return NextResponse.json({ error: 'userId و projectId مطلوبان' }, { status: 400 });
        }

        const { data: profile, error: readErr } = await supabaseAdmin
            .from('profiles')
            .select('allowed_projects')
            .eq('id', userId)
            .single();

        if (readErr || !profile) {
            return NextResponse.json({ error: 'لم يُعثر على المستخدم' }, { status: 404 });
        }

        const current: string[] = profile.allowed_projects || [];
        const hasAccess = current.includes(projectId);
        const updated = hasAccess
            ? current.filter((id: string) => id !== projectId)
            : [...current, projectId];

        const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update({ allowed_projects: updated })
            .eq('id', userId);

        if (updateErr) throw updateErr;

        return NextResponse.json({ success: true, hasAccess: !hasAccess });
    } catch {
        return NextResponse.json({ error: 'حدث خطأ في تحديث الصلاحيات' }, { status: 500 });
    }
}
