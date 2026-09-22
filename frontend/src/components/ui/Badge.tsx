import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'attack'
  | 'cve'
  | 'valid'
  | 'warn'
  | 'crit'
  | 'outline'
  | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  className = '',
  children,
  ...props
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-surface-2 text-ink-primary border-border',
    attack: 'bg-attack-surface text-attack-ink border-attack-border shadow-sm',
    cve: 'bg-cve-surface text-cve-ink border-cve-border',
    valid: 'bg-valid-surface text-valid-ink border-valid-border',
    warn: 'bg-amber-950/40 text-amber-300 border-amber-800/60',
    crit: 'bg-red-950/40 text-red-300 border-red-800/60',
    outline: 'bg-transparent text-ink-muted border-border hover:border-border-strong',
    neutral: 'bg-surface-3 text-ink-muted border-border',
  };

  return (
    <span
      className={`inline-flex items-center font-mono font-medium tracking-wide uppercase border rounded-sm transition-colors ${sizeClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
