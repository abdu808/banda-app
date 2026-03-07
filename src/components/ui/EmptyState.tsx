interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-slate-200">
            {icon && (
                <div className="flex items-center justify-center mb-4">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                        {icon}
                    </div>
                </div>
            )}
            <h3 className="text-base font-semibold text-slate-700">{title}</h3>
            {description && <p className="mt-1 text-sm text-slate-400 max-w-xs mx-auto">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

/** Skeleton loading grid */
export function SkeletonGrid({ count = 3, height = 'h-44' }: { count?: number; height?: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className={`${height} skeleton rounded-2xl`} />
            ))}
        </div>
    );
}

/** Skeleton list loading */
export function SkeletonList({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="h-14 skeleton rounded-xl" />
            ))}
        </div>
    );
}
