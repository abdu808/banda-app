import { STATUS_MAP } from '@/lib/constants';

interface StatusBadgeProps {
    status: string;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
    const st = STATUS_MAP[status] ?? STATUS_MAP.completed;
    return (
        <span className={`status-badge ${st.bg} ${st.text} ${st.border} ${size === 'sm' ? 'text-[11px] px-2 py-0.5' : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
            {st.label}
        </span>
    );
}

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'blue' | 'green' | 'orange' | 'red' | 'gray' | 'indigo';
    className?: string;
}

const variantMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    orange: 'bg-amber-50 text-amber-700 border-amber-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    gray:   'bg-slate-100 text-slate-600 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function Badge({ children, variant = 'blue', className = '' }: BadgeProps) {
    return (
        <span className={`status-badge ${variantMap[variant]} ${className}`}>
            {children}
        </span>
    );
}
