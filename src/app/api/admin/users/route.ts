import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// This route uses the service_role key to create users without affecting the current session
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, role, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ users: data || [] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { email, password, name, role } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 });
        }

        // Create the auth user (without affecting current session)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim().toLowerCase(),
            password,
            email_confirm: true, // Auto-confirm email so user can log in immediately
            user_metadata: { full_name: name || '' },
        });

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        const userId = authData.user.id;

        // Upsert the profile with role
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            id: userId,
            email: email.trim().toLowerCase(),
            name: name?.trim() || null,
            role: role || 'distributor',
        });

        if (profileError) {
            // Rollback: delete the auth user if profile creation failed
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, userId });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'خطأ داخلي' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { userId } = await req.json();
        if (!userId) return NextResponse.json({ error: 'userId مطلوب' }, { status: 400 });

        // Delete profile first (cascade should handle it, but just in case)
        await supabaseAdmin.from('profiles').delete().eq('id', userId);
        // Delete auth user
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'خطأ داخلي' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { userId, role, password } = await req.json();
        if (!userId) return NextResponse.json({ error: 'userId مطلوب' }, { status: 400 });

        if (password) {
            const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        }

        if (role) {
            const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', userId);
            if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'خطأ داخلي' }, { status: 500 });
    }
}
