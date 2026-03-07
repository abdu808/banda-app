'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    description?: string;
    backHref?: string;
    actions?: React.ReactNode;
    icon?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, actions, icon }: PageHeaderProps) {
    const router = useRouter();

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                {backHref && (
                    <button
                        onClick={() => router.push(backHref)}
                        className="p-2 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all flex-shrink-0"
                        aria-label="رجوع"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}
                {icon && (
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600">
                        {icon}
                    </div>
                )}
                <div>
                    <h1 className="text-xl font-bold text-slate-900">{title}</h1>
                    {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-2 flex-shrink-0">
                    {actions}
                </div>
            )}
        </div>
    );
}
