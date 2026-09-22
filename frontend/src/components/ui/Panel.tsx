import React from 'react';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'sunken' | 'accent' | 'warm-paper';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  variant = 'default',
  header,
  footer,
  noPadding = false,
  className = '',
  children,
  ...props
}) => {
  const variantClasses: Record<string, string> = {
    default: 'bg-surface-1 border-border',
    elevated: 'bg-surface-2 border-border shadow-card-elevated',
    sunken: 'bg-[#09090C] border-border-subtle',
    accent: 'bg-surface-1 border-attack-border shadow-glow-sm',
    'warm-paper': 'evidence-paper',
  };

  return (
    <div
      className={`border transition-all duration-200 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {header && (
        <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
          {header}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-border px-5 py-3 bg-surface-2/40 text-xs font-mono text-ink-muted flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
};
