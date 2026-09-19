import React from 'react';
import { OverviewResponse } from '../types/api';
import { TabId } from './Navbar';

interface OverviewDashboardProps {
  overview: OverviewResponse | null;
  onNavigate: (tab: TabId) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ overview, onNavigate }) => {
  const totalChunks = overview?.corpus.total_chunks ?? 1162;
  const attackCount = overview?.corpus.mitre_attack_techniques ?? 697;
  const cveCount = overview?.corpus.cve_records ?? 20;
  const sha = overview?.corpus.sha256 ?? 'cdcc7258098ffa61';

  return (
    <div className="space-y-6">
      {/* Editorial Title & Research Question Banner */}
      <div className="border border-border bg-surface-1 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-border pb-3 gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              Research Instrument
            </span>
            <span className="text-border text-xs">/</span>
            <span className="font-mono text-[11px] text-ink-primary">
              Corpus Provenance &amp; System Tiers
            </span>
          </div>
          <span className="font-mono text-xs text-ink-muted">
            sha256:{sha.slice(0, 12)}...
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-ink-primary tracking-tight">
            Hybrid RAG Over a Niche Cybersecurity Corpus
          </h1>

          <div className="p-4 bg-surface-2 border-l-2 border-ink-primary space-y-1 mt-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
              Primary Research Question (RQ)
            </div>
            <p className="font-serif italic text-sm sm:text-base text-ink-primary leading-relaxed">
              &ldquo;{overview?.research_question || 'For which classes of cybersecurity query does dense, sparse, or hybrid retrieval perform best — and how much do reranking, query understanding, and metadata filtering change that answer?'}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* High-Density Forensic Corpus Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="border border-border bg-surface-1 p-3.5 space-y-1">
          <div className="font-mono text-[11px] text-ink-muted">Corpus Chunks</div>
          <div className="text-2xl font-serif font-normal text-ink-primary">
            {totalChunks}
          </div>
          <div className="text-[10px] font-mono text-ink-faint">Qdrant dual-vector points</div>
        </div>

        <div className="border border-border bg-surface-1 p-3.5 space-y-1">
          <div className="font-mono text-[11px] text-attack">ATT&amp;CK Techniques</div>
          <div className="text-2xl font-serif font-normal text-attack">
            {attackCount}
          </div>
          <div className="text-[10px] font-mono text-ink-faint">Enterprise v14.1 STIX 2.1</div>
        </div>

        <div className="border border-border bg-surface-1 p-3.5 space-y-1">
          <div className="font-mono text-[11px] text-cve-warn">CVE Records</div>
          <div className="text-2xl font-serif font-normal text-cve-warn">
            {cveCount}
          </div>
          <div className="text-[10px] font-mono text-ink-faint">Curated critical advisories</div>
        </div>

        <div className="border border-border bg-surface-1 p-3.5 space-y-1">
          <div className="font-mono text-[11px] text-ink-muted">Named Vectors</div>
          <div className="text-2xl font-serif font-normal text-ink-primary">
            2
          </div>
          <div className="text-[10px] font-mono text-ink-faint">dense + sparse per chunk</div>
        </div>

        <div className="border border-border bg-surface-1 p-3.5 space-y-1">
          <div className="font-mono text-[11px] text-ink-muted">Evaluation Splits</div>
          <div className="text-2xl font-serif font-normal text-ink-primary">
            80 + 70
          </div>
          <div className="text-[10px] font-mono text-ink-faint">DEV/TEST + OOD probes</div>
        </div>

        <div className="border border-border bg-surface-1 p-3.5 space-y-1">
          <div className="font-mono text-[11px] text-valid">Corpus SHA256</div>
          <div className="text-base font-mono font-bold text-ink-primary truncate" title={sha}>
            {sha.slice(0, 10)}...
          </div>
          <div className="text-[10px] font-mono text-ink-faint">Frozen benchmark hash</div>
        </div>
      </div>

      {/* Two-Column: Retrieval Tiers & Research Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Retrieval Tiers */}
        <div className="border border-border bg-surface-1 p-5 space-y-4">
          <div className="border-b border-border pb-2 flex items-center justify-between">
            <h2 className="font-serif font-semibold text-sm text-ink-primary">
              Retrieval Architecture Tiers
            </h2>
            <span className="font-mono text-[11px] text-ink-muted">ARCHITECTURE.md §42</span>
          </div>

          <div className="space-y-4">
            {/* Tier A */}
            <div className="p-4 bg-surface-2 border-l-2 border-valid space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-valid" />
                  <span className="font-mono text-xs font-bold text-ink-primary">
                    TIER A (ACTIVE / EXECUTABLE)
                  </span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 border border-border bg-surface-3 text-ink-muted">
                  Local Stand-in Stack
                </span>
              </div>
              <ul className="text-xs space-y-1 text-ink-muted font-mono list-disc pl-4">
                <li><strong className="text-ink-primary">Dense:</strong> TF-IDF + TruncatedSVD (LSA 128-d cosine)</li>
                <li><strong className="text-ink-primary">Sparse:</strong> BM25 (rank-bm25, alphanumeric word regex)</li>
                <li><strong className="text-ink-primary">Fusion:</strong> Server-Side Qdrant RRF (<code>k=60, w=[2.0, 1.0]</code>)</li>
                <li><strong className="text-ink-primary">Reranker:</strong> Lexical Overlap + Exact ID Boost</li>
                <li><strong className="text-ink-primary">Generator:</strong> Extractive sentence assembly (100% grounded)</li>
              </ul>
              <div className="text-[11px] text-valid font-mono pt-1">
                100% offline, zero external API keys, fitted in ~6s over 1,162 chunks.
              </div>
            </div>

            {/* Tier B */}
            <div className="p-4 bg-surface-2 border border-border space-y-2 opacity-90">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-ink-faint" />
                  <span className="font-mono text-xs font-bold text-ink-muted">
                    TIER B (TARGET NEURAL SPEC)
                  </span>
                </div>
                <span className="font-mono text-[10px] px-1.5 py-0.5 border border-border bg-surface-3 text-ink-faint">
                  Documented Spec
                </span>
              </div>
              <ul className="text-xs space-y-1 text-ink-muted font-mono list-disc pl-4">
                <li><strong className="text-ink-primary">Dense:</strong> BAAI/bge-small-en-v1.5 (384-d bi-encoder)</li>
                <li><strong className="text-ink-primary">Sparse:</strong> BM25 (Qdrant sparse vectors)</li>
                <li><strong className="text-ink-primary">Fusion:</strong> Server-Side RRF (<code>w=[2.0, 1.0]</code>)</li>
                <li><strong className="text-ink-primary">Reranker:</strong> ms-marco-MiniLM-L-6-v2 Cross-Encoder</li>
                <li><strong className="text-ink-primary">Generator:</strong> Claude 3.5 Sonnet / Local Llama 3</li>
              </ul>
              <div className="text-[11px] text-ink-faint font-mono pt-1">
                Evaluated in experiments/final_test_summary.md on PyTorch CPU.
              </div>
            </div>
          </div>
        </div>

        {/* Backend & Research Status */}
        <div className="border border-border bg-surface-1 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <h2 className="font-serif font-semibold text-sm text-ink-primary">
                Held-Out Benchmark &amp; Research Status
              </h2>
              <span className="font-mono text-[10px] px-2 py-0.5 border border-valid/40 bg-surface-2 text-valid font-bold">
                EVALUATED
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-surface-2 border border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-ink-primary">Held-Out TEST Evaluation</div>
                  <div className="text-ink-muted text-[11px]">Single-pass test against frozen benchmark</div>
                </div>
                <span className="font-mono text-valid font-bold">MRR: 0.738 | nDCG@5: 0.850</span>
              </div>

              <div className="p-3 bg-surface-2 border border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-ink-primary">First-Stage Synergy (H4 &amp; H6)</div>
                  <div className="text-ink-muted text-[11px]">Hybrid RRF nDCG@5 vs BM25 on DEV</div>
                </div>
                <span className="font-mono text-valid font-bold">+0.1039 (p=0.0136)</span>
              </div>

              <div className="p-3 bg-surface-2 border border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-ink-primary">Exact Identifier Dominance</div>
                  <div className="text-ink-muted text-[11px]">BM25 vs Dense BGE on CVE/Technique IDs</div>
                </div>
                <span className="font-mono text-cve-warn font-bold">MRR 1.000 vs 0.365</span>
              </div>

              <div className="p-3 bg-surface-2 border border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-ink-primary">Cross-Encoder Significance</div>
                  <div className="text-ink-muted text-[11px]">ms-marco-MiniLM-L-6-v2 vs First-Stage Hybrid</div>
                </div>
                <span className="font-mono text-valid font-bold">+0.1382 nDCG (p=0.0158)</span>
              </div>
            </div>
          </div>

          {/* Direct Pipeline Navigation */}
          <div className="pt-3 border-t border-border grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigate('playground')}
              className="px-3 py-2 bg-surface-3 hover:bg-border text-ink-primary border border-border text-xs font-mono transition-colors text-center"
            >
              Launch Playground &rarr;
            </button>
            <button
              type="button"
              onClick={() => onNavigate('evaluation')}
              className="px-3 py-2 bg-surface-2 hover:bg-surface-3 text-ink-primary border border-border text-xs font-mono transition-colors text-center"
            >
              Inspect Evaluation &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
