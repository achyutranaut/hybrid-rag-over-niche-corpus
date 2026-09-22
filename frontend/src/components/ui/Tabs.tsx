import React from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: 'pills' | 'underline' | 'buttons';
  className?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className = '',
}: TabsProps<T>) {
  if (variant === 'buttons') {
    return (
      <div className={`inline-flex p-1 bg-surface-2 border border-border rounded-sm ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-sm transition-colors flex items-center space-x-1.5 ${
                isActive
                  ? 'bg-surface-3 text-ink-primary font-semibold border border-border-strong shadow-sm'
                  : 'text-ink-muted hover:text-ink-primary hover:bg-surface-3/50'
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="text-[10px] px-1 py-0.2 bg-surface-1 rounded border border-border text-ink-faint">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex border-b border-border space-x-1 overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 text-xs font-mono transition-all relative flex items-center space-x-2 whitespace-nowrap border-b-2 -mb-px ${
              isActive
                ? 'border-ink-primary text-ink-primary font-bold bg-surface-1/60'
                : 'border-transparent text-ink-muted hover:text-ink-primary hover:bg-surface-2/40'
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-normal ${
                isActive ? 'border-border-strong text-ink-primary bg-surface-2' : 'border-border text-ink-faint'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
