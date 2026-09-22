import React, { useState } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 px-2.5 py-1.5 bg-[#09090C] border border-border-strong text-ink-primary text-xs font-mono rounded-sm shadow-xl whitespace-nowrap pointer-events-none transition-opacity ${
            position === 'top'
              ? 'bottom-full mb-1.5 left-1/2 -translate-x-1/2'
              : 'top-full mt-1.5 left-1/2 -translate-x-1/2'
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
