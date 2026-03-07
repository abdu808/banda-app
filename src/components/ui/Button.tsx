import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: React.ReactNode;
    iconPosition?: 'right' | 'left';
}

const variantClasses: Record<ButtonVariant, string> = {
    primary:   'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-100 disabled:bg-blue-300',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm disabled:opacity-50',
    danger:    'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-100 disabled:bg-red-300',
    success:   'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-100 disabled:bg-emerald-300',
    ghost:     'hover:bg-slate-100 text-slate-600 disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2.5 text-sm rounded-[10px] gap-2',
    lg: 'px-5 py-3 text-base rounded-xl gap-2',
};

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'right',
    children,
    disabled,
    className = '',
    ...props
}: ButtonProps) {
    return (
        <button
            disabled={disabled || loading}
            className={`
                inline-flex items-center justify-center font-semibold
                transition-all duration-150 active:scale-[0.97]
                disabled:cursor-not-allowed
                ${variantClasses[variant]}
                ${sizeClasses[size]}
                ${className}
            `}
            {...props}
        >
            {loading ? (
                <>
                    <Spinner size="sm" />
                    {children && <span>{children}</span>}
                </>
            ) : (
                <>
                    {icon && iconPosition === 'right' && icon}
                    {children && <span>{children}</span>}
                    {icon && iconPosition === 'left' && icon}
                </>
            )}
        </button>
    );
}
