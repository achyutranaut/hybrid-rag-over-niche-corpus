import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  className = '',
  ...props
}) => {
  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2.5',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-ink-primary text-canvas hover:bg-white font-semibold border border-ink-primary shadow-sm active:translate-y-[0.5px]',
    secondary:
      'bg-surface-2 hover:bg-surface-3 text-ink-primary border border-border hover:border-border-strong active:translate-y-[0.5px]',
    ghost:
      'bg-transparent hover:bg-surface-2 text-ink-muted hover:text-ink-primary border border-transparent hover:border-border/60',
    outline:
      'bg-transparent hover:bg-surface-2 text-ink-primary border border-border hover:border-ink-primary/60',
    danger:
      'bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-800/80',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-mono transition-all duration-150 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary disabled:opacity-45 disabled:pointer-events-none select-none cursor-pointer ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin inline-block rounded-full" />
      ) : icon ? (
        <span className="flex-shrink-0 flex items-center justify-center">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};
