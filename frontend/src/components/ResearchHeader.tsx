import React, { useState } from 'react';
import { OverviewResponse } from '../types/api';
import { Badge } from './ui/Badge';
import { CyberShieldLogo } from './ui/CyberShieldLogo';

interface ResearchHeaderProps {
  overview: OverviewResponse | null;
  backendOnline: boolean;
}

export const ResearchHeader: React.FC<ResearchHeaderProps> = ({ overview, backendOnline }) => {
  const sha = overview?.corpus?.sha256 || 'cdcc7258098ffa61';
  const totalChunks = overview?.corpus?.total_chunks ?? 1162;
  const attackCount = overview?.corpus?.mitre_attack_techniques ?? 697;
  const cveCount = overview?.corpus?.cve_records ?? 20;

  const [copiedSha, setCopiedSha] = useState(false);

  const copySha = () => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 1800);
  };

  return (
    <header className="border-b border-border bg-[#08080B]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3 lg:gap-6">
          {/* Scientific Title & Corpus Provenance */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0 flex-1">
            <div className="flex items-center justify-center p-1 rounded-sm bg-surface-2 border border-attack-border shadow-glow-sm flex-shrink-0">
              <CyberShieldLogo size={24} />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="font-serif font-bold text-sm tracking-wide text-ink-primary whitespace-nowrap flex-shrink-0">
                  CYBER-RAG LAB
                </span>
                <span className="text-border-strong text-xs hidden xl:inline flex-shrink-0">•</span>
                <span className="text-[11px] text-ink-muted font-sans hidden xl:inline truncate">
                  Advanced Threat Intelligence &amp; Retrieval Engine
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] font-mono text-ink-faint truncate">
                <span className="truncate">Hybrid RAG • MITRE ATT&amp;CK v14.1 &amp; NVD CVE</span>
              </div>
            </div>

            {/* Corpus Hash Tag with Instant Copy (Hidden on tight screens to avoid congestion) */}
            <button
              type="button"
              onClick={copySha}
              title={`Click to copy verified corpus SHA256: ${sha}`}
              className="hidden 2xl:flex items-center space-x-1.5 px-2 py-0.5 rounded-sm bg-surface-1 hover:bg-surface-2 border border-border text-[11px] font-mono text-ink-muted transition-colors cursor-pointer flex-shrink-0 whitespace-nowrap"
            >
              <span className="text-ink-faint">sha256:</span>
              <span className="text-ink-primary font-tabular">{sha.slice(0, 8)}...</span>
              <span className="text-[9px] text-ink-faint">{copiedSha ? '✓' : '⧉'}</span>
            </button>
          </div>

          {/* Corpus Statistics & System Telemetry */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 text-xs font-mono flex-shrink-0">
            {/* Technique & CVE Pill Count */}
            <div className="hidden sm:flex items-center space-x-1.5 flex-shrink-0">
              <Badge variant="attack" size="sm">
                {attackCount} ATT&amp;CK
              </Badge>
              <Badge variant="cve" size="sm">
                {cveCount} CVE
              </Badge>
              <span className="hidden md:inline-flex text-[11px] text-ink-muted px-1.5 py-0.5 bg-surface-2 border border-border rounded-sm font-tabular whitespace-nowrap flex-shrink-0">
                {totalChunks} Chunks
              </span>
            </div>

            {/* Active Stack Tier Badge */}
            <div className="hidden xl:flex items-center space-x-1.5 px-2 py-1 rounded-sm bg-surface-2 border border-border text-[11px] flex-shrink-0 whitespace-nowrap">
              <span className="text-ink-faint">Stack:</span>
              <span className="text-ink-primary font-medium">Tier A</span>
            </div>

            {/* Engine Heartbeat */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-sm border flex-shrink-0 whitespace-nowrap ${
                backendOnline
                  ? 'bg-valid-surface border-valid-border text-valid-ink'
                  : 'bg-red-950/30 border-red-800/50 text-red-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  backendOnline ? 'bg-valid animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">
                {backendOnline ? 'ENGINE ONLINE' : 'ENGINE OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
