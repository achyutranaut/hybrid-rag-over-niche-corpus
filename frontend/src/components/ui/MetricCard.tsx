import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: 'default' | 'attack' | 'cve' | 'valid' | 'neutral';
  badge?: string;
  trend?: {
    text: string;
    positive?: boolean;
  };
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  highlight = 'default',
  badge,
  trend,
  className = '',
}) => {
  const valueColors: Record<string, string> = {
    default: 'text-ink-primary',
    attack: 'text-attack',
    cve: 'text-cve-warn',
    valid: 'text-valid',
    neutral: 'text-ink-muted',
  };

  return (
    <div className={`p-4 bg-surface-1 border border-border flex flex-col justify-between space-y-2 hover:border-border-strong transition-colors ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-ink-muted uppercase tracking-wider">
          {label}
        </span>
        {badge && (
          <span className="font-mono text-[9px] px-1.5 py-0.2 border border-border bg-surface-2 text-ink-faint rounded-sm uppercase">
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-baseline space-x-2">
        <div className={`text-2xl sm:text-3xl font-serif font-normal tracking-tight font-tabular ${valueColors[highlight]}`}>
          {value}
        </div>
        {trend && (
          <span className={`text-[11px] font-mono ${trend.positive ? 'text-valid' : 'text-cve-warn'}`}>
            {trend.text}
          </span>
        )}
      </div>

      {subtext && (
        <div className="text-[10px] font-mono text-ink-faint truncate" title={subtext}>
          {subtext}
        </div>
      )}
    </div>
  );
};
