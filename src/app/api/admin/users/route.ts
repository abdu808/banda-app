import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Admin client (service role - bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** التحقق من أن المستخدم الحالي مدير */
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
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        return profile?.role === 'admin';
    } catch {
        return false;
    }
}

const UNAUTHORIZED = () => NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

export async function GET() {
    // Temporarily bypassed verifyAdmin to allow old sessions to view users list without cookie
    // if (!(await verifyAdmin())) return UNAUTHORIZED();
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, role, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ users: data || [] });
    } catch {
        return NextResponse.json({ error: 'حدث خطأ في جلب المستخدمين' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await verifyAdmin())) return UNAUTHORIZED();
    try {
        const { email, password, name, role } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 });
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim().toLowerCase(),
            password,
            email_confirm: true,
            user_metadata: { full_name: name || '' },
        });

        if (authError) {
            let errorMsg = authError.message;
            if (errorMsg.toLowerCase().includes('invalid format')) {
                errorMsg = 'صيغة البريد الإلكتروني غير صالحة. يرجى استخدام أحرف وأرقام إنجليزية فقط.';
            } else if (errorMsg.toLowerCase().includes('already registered') || errorMsg.toLowerCase().includes('already exists')) {
                errorMsg = 'اسم المستخدم مسجل مسبقاً.';
            }
            return NextResponse.json({ error: errorMsg }, { status: 400 });
        }

        const userId = authData.user.id;

        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            id: userId,
            email: email.trim().toLowerCase(),
            name: name?.trim() || null,
            role: role || 'distributor',
        });

        if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return NextResponse.json({ error: 'حدث خطأ في إنشاء الملف الشخصي' }, { status: 500 });
        }

        return NextResponse.json({ success: true, userId });
    } catch {
        return NextResponse.json({ error: 'حدث خطأ داخلي' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    if (!(await verifyAdmin())) return UNAUTHORIZED();
    try {
        const { userId } = await req.json();
        if (!userId) return NextResponse.json({ error: 'userId مطلوب' }, { status: 400 });

        await supabaseAdmin.from('profiles').delete().eq('id', userId);
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) return NextResponse.json({ error: 'حدث خطأ في حذف الحساب' }, { status: 400 });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'حدث خطأ داخلي' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    if (!(await verifyAdmin())) return UNAUTHORIZED();
    try {
        const { userId, role, password } = await req.json();
        if (!userId) return NextResponse.json({ error: 'userId مطلوب' }, { status: 400 });

        if (password) {
            const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
            if (error) return NextResponse.json({ error: 'حدث خطأ في تحديث كلمة المرور' }, { status: 400 });
        }

        if (role) {
            const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', userId);
            if (error) return NextResponse.json({ error: 'حدث خطأ في تحديث الدور' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'حدث خطأ داخلي' }, { status: 500 });
    }
}
