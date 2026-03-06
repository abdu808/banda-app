import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET all distributors (bypasses RLS — admin-only route)
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name, role, allowed_projects')
            .eq('role', 'distributor')
            .order('email');

        if (error) throw error;

        return NextResponse.json({ distributors: data || [] });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
