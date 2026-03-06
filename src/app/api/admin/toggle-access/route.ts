import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: toggle a distributor's access to a project
export async function POST(req: NextRequest) {
    try {
        const { userId, projectId } = await req.json();
        if (!userId || !projectId) {
            return NextResponse.json({ error: 'userId و projectId مطلوبان' }, { status: 400 });
        }

        // Read current allowed_projects
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
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
