import React from 'react';
import { OverviewResponse } from '../types/api';
import { TabId } from './Navbar';
import { MetricCard } from './ui/MetricCard';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Panel } from './ui/Panel';

interface OverviewDashboardProps {
  overview: OverviewResponse | null;
  onNavigate: (tab: TabId) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ overview, onNavigate }) => {
  const totalChunks = overview?.corpus?.total_chunks ?? 1162;
  const attackCount = overview?.corpus?.mitre_attack_techniques ?? 697;
  const cveCount = overview?.corpus?.cve_records ?? 20;
  const sha = overview?.corpus?.sha256 ?? 'cdcc7258098ffa61';

  return (
    <div className="space-y-6">
      {/* Editorial Title & Primary Research Question */}
      <Panel
        header={
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between w-full gap-2">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                Research Instrument Protocol
              </span>
              <span className="text-border text-xs">/</span>
              <span className="font-mono text-[11px] text-ink-primary">
                Corpus Provenance &amp; Dual-Vector Architecture
              </span>
            </div>
            <span className="font-mono text-xs text-ink-faint">
              sha256:{sha.slice(0, 12)}...
            </span>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <span className="text-[11px] font-mono text-attack tracking-widest uppercase font-semibold">
              MITRE ATT&amp;CK v14.1 &bull; NVD CVE Corpus
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-ink-primary tracking-tight mt-1">
              Hybrid RAG Over a Niche Cybersecurity Corpus
            </h1>
          </div>

          <div className="p-5 bg-surface-2 border-l-2 border-attack space-y-2 rounded-r-sm">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-faint flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-attack" />
              <span>Core Research Question (RQ)</span>
            </div>
            <p className="font-serif italic text-sm sm:text-base text-ink-primary leading-relaxed">
              &ldquo;{overview?.research_question || 'For which classes of cybersecurity query does dense, sparse, or hybrid retrieval perform best — and how much do reranking, query understanding, and metadata filtering change that answer?'}&rdquo;
            </p>
          </div>
        </div>
      </Panel>

      {/* High-Density Forensic Corpus Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Corpus Chunks"
          value={totalChunks}
          subtext="Qdrant points"
          highlight="default"
        />
        <MetricCard
          label="ATT&CK Techniques"
          value={attackCount}
          subtext="Enterprise v14.1 STIX 2.1"
          highlight="attack"
        />
        <MetricCard
          label="CVE Records"
          value={cveCount}
          subtext="Curated critical advisories"
          highlight="cve"
        />
        <MetricCard
          label="Named Vectors"
          value="2"
          subtext="dense + sparse per chunk"
          highlight="default"
        />
        <MetricCard
          label="Eval Splits"
          value="80 + 70"
          subtext="DEV/TEST + OOD probes"
          highlight="default"
        />
        <MetricCard
          label="Corpus Hash"
          value={sha.slice(0, 7)}
          subtext="Frozen SHA256 benchmark"
          highlight="valid"
        />
      </div>

      {/* Two-Column: Retrieval Tiers & Research Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Retrieval Tiers */}
        <Panel
          header={
            <div className="flex items-center justify-between w-full">
              <h2 className="font-serif font-semibold text-sm text-ink-primary">
                Retrieval Architecture Tiers
              </h2>
              <span className="font-mono text-[11px] text-ink-faint">ARCHITECTURE.md §42</span>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Tier A */}
            <div className="p-4 bg-surface-2 border border-valid-border/40 rounded-sm space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-valid shadow-glow-valid" />
                  <span className="font-mono text-xs font-bold text-ink-primary">
                    TIER A (ACTIVE / EXECUTABLE)
                  </span>
                </div>
                <Badge variant="valid" size="sm">
                  Local Stand-in Stack
                </Badge>
              </div>
              <ul className="text-xs space-y-1.5 text-ink-muted font-mono list-disc pl-4">
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
            <div className="p-4 bg-surface-2 border border-border rounded-sm space-y-2 opacity-85">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-ink-faint" />
                  <span className="font-mono text-xs font-bold text-ink-muted">
                    TIER B (TARGET NEURAL SPEC)
                  </span>
                </div>
                <Badge variant="neutral" size="sm">
                  Documented Spec
                </Badge>
              </div>
              <ul className="text-xs space-y-1.5 text-ink-muted font-mono list-disc pl-4">
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
        </Panel>

        {/* Backend & Research Status */}
        <Panel
          header={
            <div className="flex items-center justify-between w-full">
              <h2 className="font-serif font-semibold text-sm text-ink-primary">
                Held-Out Benchmark &amp; Research Status
              </h2>
              <Badge variant="valid" size="sm">
                EVALUATED
              </Badge>
            </div>
          }
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigate('playground')}
              >
                Launch Playground &rarr;
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('evaluation')}
              >
                Inspect Evaluation &rarr;
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="p-3 bg-surface-2 border border-border rounded-sm flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-ink-primary">Held-Out TEST Evaluation</div>
                <div className="text-ink-muted text-[11px]">Single-pass test against frozen benchmark</div>
              </div>
              <span className="font-mono text-valid text-xs font-bold font-tabular">
                MRR: 0.738 | nDCG@5: 0.850
              </span>
            </div>

            <div className="p-3 bg-surface-2 border border-border rounded-sm flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-ink-primary">First-Stage Synergy (H4 &amp; H6)</div>
                <div className="text-ink-muted text-[11px]">Hybrid RRF nDCG@5 vs BM25 on DEV</div>
              </div>
              <span className="font-mono text-valid text-xs font-bold font-tabular">
                +0.1039 (p=0.0136)
              </span>
            </div>

            <div className="p-3 bg-surface-2 border border-border rounded-sm flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-ink-primary">Exact Identifier Dominance</div>
                <div className="text-ink-muted text-[11px]">BM25 vs Dense BGE on CVE/Technique IDs</div>
              </div>
              <span className="font-mono text-cve-warn text-xs font-bold font-tabular">
                MRR 1.000 vs 0.365
              </span>
            </div>

            <div className="p-3 bg-surface-2 border border-border rounded-sm flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-ink-primary">Cross-Encoder Significance</div>
                <div className="text-ink-muted text-[11px]">ms-marco-MiniLM-L-6-v2 vs First-Stage Hybrid</div>
              </div>
              <span className="font-mono text-valid text-xs font-bold font-tabular">
                +0.1382 nDCG (p=0.0158)
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
