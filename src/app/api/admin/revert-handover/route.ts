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

export async function POST(req: NextRequest) {
    if (!(await verifyAdmin())) return UNAUTHORIZED();
    try {
        const { beneficiaryId, projectId } = await req.json();

        if (!beneficiaryId || !projectId) {
            return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
        }

        // 1. Fetch beneficiary to ensure it exists and is received
        const { data: beneficiary, error: fetchError } = await supabaseAdmin
            .from('beneficiaries')
            .select('status')
            .eq('id', beneficiaryId)
            .eq('project_id', projectId)
            .single();

        if (fetchError || !beneficiary) {
            return NextResponse.json({ error: 'المستفيد غير موجود في هذا المشروع' }, { status: 404 });
        }

        if (beneficiary.status !== 'received') {
            return NextResponse.json({ error: 'لم يتم تسليم هذا المستفيد بعد لكي يتم التراجع عنه' }, { status: 400 });
        }

        // 2. Clear assigned cards (if any)
        const { error: cardsError } = await supabaseAdmin
            .from('cards')
            .update({ status: 'available', assigned_to: null, assigned_at: null })
            .eq('assigned_to', beneficiaryId);

        if (cardsError) {
            return NextResponse.json({ error: 'حدث خطأ أثناء تحرير البطاقات' }, { status: 500 });
        }

        // 3. Revert beneficiary status to pending and clear handover details
        const { error: updateError } = await supabaseAdmin
            .from('beneficiaries')
            .update({
                status: 'pending',
                received_at: null,
                distributed_by_id: null,
                distributed_by_name: null,
                proxy_name: null,
                field_notes: null
            })
            .eq('id', beneficiaryId);

        if (updateError) {
            return NextResponse.json({ error: 'حدث خطأ أثناء تحديث حالة المستفيد' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'تم التراجع عن التسليم بنجاح' });
    } catch {
        return NextResponse.json({ error: 'حدث خطأ داخلي' }, { status: 500 });
    }
}
