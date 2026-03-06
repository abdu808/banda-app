import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware disabled — auth protection is handled client-side in dashboard/layout.tsx
// The Supabase cookie name varies per project and caused infinite redirect loops.
export function middleware(request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: [],
};
