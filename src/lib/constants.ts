// ===== نظام البطاقات - ثوابت المشروع =====

export const STATUS_MAP: Record<string, {
    label: string;
    bg: string;
    text: string;
    dot: string;
    border: string;
}> = {
    active: {
        label: 'نشط',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
        border: 'border-emerald-200',
    },
    paused: {
        label: 'موقوف',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        dot: 'bg-amber-400',
        border: 'border-amber-200',
    },
    completed: {
        label: 'مكتمل',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        dot: 'bg-slate-400',
        border: 'border-slate-200',
    },
    closed: {
        label: 'مغلق',
        bg: 'bg-red-50',
        text: 'text-red-700',
        dot: 'bg-red-400',
        border: 'border-red-200',
    },
};

// ترقيم الصفحات
export const PAGINATION_STEP = 999;
export const TABLE_PAGE_SIZE = 50;

// حدود البطاقات
export const MAX_CARDS_PER_INPUT = 50;
export const DEFAULT_CARDS_PER_BENEFICIARY = 2;

// تأخير البحث
export const SEARCH_DEBOUNCE_MS = 350;

// نطاق البريد الإلكتروني الافتراضي
export const DEFAULT_EMAIL_DOMAIN = 'banda.app';
