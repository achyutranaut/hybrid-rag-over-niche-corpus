import React from 'react';
import { formatScore } from '../utils/format';
import { Badge } from './ui/Badge';

interface HeroMetricProps {
  split?: 'test' | 'dev';
  mrr?: number;
  ndcg?: number;
  recall?: number;
  queryCount?: number;
  corpusSha?: string;
  significanceNote?: string;
}

export const HeroMetric: React.FC<HeroMetricProps> = ({
  split = 'test',
  mrr = 0.7381,
  ndcg = 0.8502,
  recall = 0.6786,
  queryCount = 16,
  corpusSha = 'cdcc7258098ffa61',
  significanceNote = 'p = 0.0158 (Wilcoxon Signed-Rank vs first-stage)',
}) => {
  const isTest = split === 'test';

  return (
    <div className="border border-border bg-surface-1 p-6 relative overflow-hidden rounded-sm shadow-card-elevated">
      {/* Top Editorial Rule & Context */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-border pb-3 mb-6 gap-2">
        <div className="flex items-center space-x-2">
          <Badge variant="attack" size="sm">
            Benchmark Protocol
          </Badge>
          <span className="text-border text-xs">/</span>
          <span className="font-mono text-[11px] font-semibold text-ink-primary">
            {isTest ? 'Frozen Held-Out Evaluation' : 'Development Parameter Calibration'}
          </span>
        </div>

        <div className="flex items-center space-x-3 text-[11px] font-mono text-ink-muted">
          <span>
            split: <strong className="text-ink-primary font-normal">{split.toUpperCase()} (n={queryCount})</strong>
          </span>
          <span>•</span>
          <span>
            hash: <strong className="text-ink-primary font-normal font-tabular">{corpusSha.slice(0, 10)}</strong>
          </span>
        </div>
      </div>

      {/* Main Scientific Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {/* Metric 1: MRR */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs text-ink-muted uppercase tracking-wider">
              Mean Reciprocal Rank (MRR)
            </span>
            <span className="text-[10px] font-mono text-ink-faint">primary</span>
          </div>
          <div className="text-4xl sm:text-5xl font-serif font-normal text-ink-primary tracking-tight font-tabular">
            {formatScore(mrr, 3)}
          </div>
          <p className="text-xs text-ink-muted font-sans pt-1">
            Top-ranked item placement across query classes.
          </p>
        </div>

        {/* Metric 2: nDCG@5 */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs text-ink-muted uppercase tracking-wider">
              nDCG@5
            </span>
            <span className="text-[10px] font-mono text-valid font-medium">stat sig</span>
          </div>
          <div className="text-4xl sm:text-5xl font-serif font-normal text-ink-primary tracking-tight font-tabular">
            {formatScore(ndcg, 3)}
          </div>
          <p className="text-xs text-ink-muted font-sans pt-1">
            {significanceNote}
          </p>
        </div>

        {/* Metric 3: Recall@5 */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-xs text-ink-muted uppercase tracking-wider">
              Recall@5
            </span>
            <span className="text-[10px] font-mono text-ink-faint">k=5 budget</span>
          </div>
          <div className="text-4xl sm:text-5xl font-serif font-normal text-ink-primary tracking-tight font-tabular">
            {formatScore(recall, 3)}
          </div>
          <p className="text-xs text-ink-muted font-sans pt-1">
            Ground-truth gold candidates retained in generation context.
          </p>
        </div>
      </div>

      {/* Verification Notice */}
      <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-ink-muted font-mono gap-2">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-valid shadow-glow-valid" />
          <span>Single-pass execution; zero post-hoc parameter adjustments</span>
        </div>
        <div className="text-ink-faint text-[11px]">
          Corpus: 697 ATT&amp;CK Techniques • 20 Real CVEs • Embedded Qdrant
        </div>
      </div>
    </div>
  );
};
