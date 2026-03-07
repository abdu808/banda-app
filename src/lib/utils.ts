// ===== نظام البطاقات - دوال مساعدة مشتركة =====

import { DEFAULT_EMAIL_DOMAIN } from './constants';

/** تحويل اسم المستخدم إلى بريد إلكتروني كامل */
export function normalizeEmail(input: string): string {
    const trimmed = input.trim().toLowerCase();
    return trimmed.includes('@') ? trimmed : `${trimmed}@${DEFAULT_EMAIL_DOMAIN}`;
}

/** عرض اسم المستخدم المختصر (بدون @banda.app) */
export function displayUsername(email: string): string {
    return email?.endsWith(`@${DEFAULT_EMAIL_DOMAIN}`)
        ? email.replace(`@${DEFAULT_EMAIL_DOMAIN}`, '')
        : email;
}

/** الأحرف الأولى للاسم للـ avatar */
export function getInitials(name: string, email?: string): string {
    const source = name || email || '?';
    const parts = source.split(/[\s@]/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
}

/** تنسيق التاريخ بالعربية */
export function formatArabicDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ar-SA', options ?? {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/** تنسيق التاريخ والوقت بالعربية */
export function formatArabicDateTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** حساب نسبة الإنجاز */
export function calcPercent(received: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.round((received / total) * 100);
}

/** تنسيق الأرقام بالعربية */
export function formatNumber(n: number): string {
    return n.toLocaleString('ar-SA');
}

/** لون Avatar تلقائي بناءً على النص */
export function avatarColor(str: string): string {
    const colors = [
        'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
        'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}
