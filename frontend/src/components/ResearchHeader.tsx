import React from 'react';
import { OverviewResponse } from '../types/api';

interface ResearchHeaderProps {
  overview: OverviewResponse | null;
  backendOnline: boolean;
}

export const ResearchHeader: React.FC<ResearchHeaderProps> = ({ overview, backendOnline }) => {
  const sha = overview?.corpus?.sha256 || 'cdcc7258098ffa61';
  const totalChunks = overview?.corpus?.total_chunks ?? 1162;
  const attackCount = overview?.corpus?.mitre_attack_techniques ?? 697;
  const cveCount = overview?.corpus?.cve_records ?? 20;

  return (
    <header className="border-b border-border bg-[#0D0D0F]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Scientific Title & Corpus ID */}
          <div className="flex items-center space-x-3">
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="font-serif font-semibold text-sm tracking-tight text-ink-primary">
                  Hybrid RAG
                </span>
                <span className="text-border text-xs">•</span>
                <span className="text-xs text-ink-muted font-sans hidden sm:inline">
                  Information Retrieval &amp; Forensic Evaluation Console
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] font-mono text-ink-muted">
                <span>corpus</span>
                <span className="text-ink-primary select-all" title={`Full SHA256: ${sha}`}>
                  sha256:{sha.slice(0, 10)}
                </span>
                <span>•</span>
                <span>{totalChunks} chunks ({attackCount} ATT&amp;CK, {cveCount} CVE)</span>
              </div>
            </div>
          </div>

          {/* Precision Status Indicator */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            {/* Active Stack Tier */}
            <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded bg-surface-2 border border-border">
              <span className="text-ink-muted">Engine:</span>
              <span className="text-ink-primary font-medium">Tier A (Local Qdrant Dual-Vector)</span>
            </div>

            {/* Heartbeat Status */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-surface-2 border border-border">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendOnline ? 'bg-valid' : 'bg-cve-crit'
                }`}
              />
              <span className={backendOnline ? 'text-ink-primary' : 'text-cve-crit'}>
                {backendOnline ? 'online' : 'offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
