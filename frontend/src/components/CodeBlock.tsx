import React, { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'python',
  filename,
  showLineNumbers = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const lines = code.trim().split('\n');

  return (
    <div className="border border-border bg-[#0A0A0B] overflow-hidden my-3 text-xs font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface-2 border-b border-border text-[11px] text-ink-muted">
        <div className="flex items-center space-x-2">
          {filename && <span className="text-ink-primary font-medium">{filename}</span>}
          <span className="text-ink-faint">({language})</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
          className="px-2 py-0.5 rounded bg-surface-3 hover:bg-border text-ink-primary text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>

      {/* Code content */}
      <div className="p-3 overflow-x-auto text-ink-primary leading-relaxed">
        <pre className="table w-full">
          {lines.map((line, idx) => (
            <div key={idx} className="table-row">
              {showLineNumbers && (
                <span className="table-cell pr-4 text-right select-none text-ink-faint text-[10px] w-8">
                  {idx + 1}
                </span>
              )}
              <span className="table-cell whitespace-pre">{line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
};
