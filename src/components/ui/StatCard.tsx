type StatVariant = 'blue' | 'green' | 'purple' | 'amber' | 'white';

interface StatCardProps {
    label: string;
    value: string | number;
    sub?: string;
    icon?: React.ReactNode;
    variant?: StatVariant;
    /** @deprecated use variant instead */
    gradient?: 'blue' | 'green' | 'purple' | 'amber';
    progress?: number; // 0-100
    className?: string;
}

const gradients: Record<string, string> = {
    blue:   'from-blue-600 to-indigo-700 shadow-blue-200',
    green:  'from-emerald-500 to-teal-600 shadow-emerald-200',
    purple: 'from-violet-600 to-purple-700 shadow-violet-200',
    amber:  'from-amber-500 to-orange-600 shadow-amber-200',
};

export function StatCard({ label, value, sub, icon, variant, gradient, progress, className = '' }: StatCardProps) {
    const colorKey = variant && variant !== 'white' ? variant : gradient;

    if (colorKey && gradients[colorKey]) {
        return (
            <div className={`bg-gradient-to-br ${gradients[colorKey]} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden ${className}`}>
                <p className="text-white/70 text-sm font-medium">{label}</p>
                <h3 className="text-3xl font-black mt-1 tabular-nums">{value}</h3>
                {sub && <div className="mt-2 text-white/60 text-sm">{sub}</div>}
                {progress !== undefined && (
                    <div className="mt-3">
                        <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white/70 rounded-full transition-all duration-700"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}
                {icon && (
                    <div className="absolute bottom-3 left-3 text-white/10 scale-[3] origin-bottom-left">
                        {icon}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between ${className}`}>
            <div>
                <p className="text-slate-500 text-sm font-medium">{label}</p>
                <h3 className="text-3xl font-black text-slate-900 mt-1 tabular-nums">{value}</h3>
                {sub && <div className="mt-1 text-slate-400 text-sm">{sub}</div>}
                {progress !== undefined && (
                    <div className="mt-3">
                        <div className="progress-bar">
                            <div className="progress-fill bg-blue-500" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}
            </div>
            {icon && (
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 flex-shrink-0">
                    {icon}
                </div>
            )}
        </div>
    );
}
