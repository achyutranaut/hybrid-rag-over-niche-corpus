import React, { useState, useMemo } from 'react';
import { RankTrackerItem, RetrievedCandidate } from '../types/api';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

interface RankShiftInspectorProps {
  rankTracker: RankTrackerItem[];
  denseCandidates: RetrievedCandidate[];
  sparseCandidates: RetrievedCandidate[];
  hybridCandidates: RetrievedCandidate[];
  rerankedCandidates: RetrievedCandidate[];
  onOpenDoc: (docId: string) => void;
}

export const RankShiftInspector: React.FC<RankShiftInspectorProps> = ({
  rankTracker,
  denseCandidates,
  sparseCandidates,
  hybridCandidates,
  rerankedCandidates,
  onOpenDoc,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>('');

  const activeId = selectedId || hoveredId;

  // Max candidates to render
  const maxRanks = Math.max(
    denseCandidates.length,
    sparseCandidates.length,
    hybridCandidates.length,
    rerankedCandidates.length,
    8
  );

  const displayLimit = Math.min(maxRanks, 10);
  const rowHeight = 40;
  const svgHeight = 60 + displayLimit * rowHeight + 35;
  const svgWidth = 940;

  // Rail X coordinates
  const lanes = [
    { name: '1. Dense (LSA)', x: 130, key: 'dense_rank' as const, candidates: denseCandidates },
    { name: '2. Sparse (BM25)', x: 370, key: 'sparse_rank' as const, candidates: sparseCandidates },
    { name: '3. Hybrid RRF (k=60)', x: 610, key: 'hybrid_rank' as const, candidates: hybridCandidates },
    { name: '4. Final Reranked', x: 830, key: 'reranked_rank' as const, candidates: rerankedCandidates },
  ];

  // Map chunk_id to item
  const candidateMap = useMemo(() => {
    const map = new Map<string, RankTrackerItem>();
    rankTracker.forEach((item) => {
      map.set(item.chunk_id, item);
    });
    return map;
  }, [rankTracker]);

  const isAttack = (id?: string) => id?.startsWith('attack:') || id?.startsWith('T');
  const isCve = (id?: string) => id?.startsWith('cve:') || id?.startsWith('CVE');

  // Filtered tracker items
  const filteredTracker = useMemo(() => {
    if (!filterQuery.trim()) return rankTracker;
    const q = filterQuery.toLowerCase();
    return rankTracker.filter(
      (item) =>
        item.chunk_id.toLowerCase().includes(q) ||
        item.parent_doc_id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q)
    );
  }, [rankTracker, filterQuery]);

  // Differential movement statistics
  const rankStats = useMemo(() => {
    let promoted = 0;
    let demoted = 0;
    let floorCut = 0;

    rankTracker.forEach((c) => {
      if (c.hybrid_rank && c.reranked_rank) {
        if (c.reranked_rank < c.hybrid_rank) promoted++;
        else if (c.reranked_rank > c.hybrid_rank) demoted++;
      } else if (c.hybrid_rank && !c.reranked_rank) {
        floorCut++;
      }
    });

    return { promoted, demoted, floorCut };
  }, [rankTracker]);

  const activeItem = activeId ? candidateMap.get(activeId) : null;

  const getCandidateColor = (id: string, isHovered: boolean) => {
    if (isHovered) return '#FFFFFF';
    if (isAttack(id)) return '#8B7EF8';
    if (isCve(id)) return '#F59E0B';
    return '#8E8E98';
  };

  return (
    <div className="border border-border bg-surface-1 p-5 rounded-sm space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-border pb-3 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Badge variant="attack" size="sm">
              Flow Visualizer
            </Badge>
            <span className="text-border text-xs">/</span>
            <h3 className="font-serif font-semibold text-sm text-ink-primary">
              Candidate Trajectory &amp; Rank-Shift Funnel
            </h3>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Trace how documents move from Dense (LSA) and Sparse (BM25) through Reciprocal Rank Fusion into the final Reranked pool.
          </p>
        </div>

        {/* Movement Telemetry & Search Filter */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-sm bg-valid-surface border border-valid-border text-valid-ink text-[11px] font-semibold">
              +{rankStats.promoted} Promoted
            </span>
            <span className="px-2 py-0.5 rounded-sm bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px]">
              -{rankStats.demoted} Demoted
            </span>
            <span className="px-2 py-0.5 rounded-sm bg-red-950/40 border border-red-800/60 text-red-300 text-[11px]">
              ✕ {rankStats.floorCut} Floor Cut
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter candidate ID..."
              className="px-2.5 py-1 bg-surface-2 border border-border text-ink-primary text-xs font-mono rounded-sm focus:outline-none focus:border-ink-primary w-36 sm:w-44"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-1.5 top-1 text-ink-faint hover:text-ink-primary text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SVG Canvas for Trajectory Splines */}
      <div className="relative overflow-x-auto bg-[#070709] border border-border p-2 rounded-sm">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[760px] select-none"
          role="img"
          aria-label="Candidate rank shift diagram across retrieval stages"
        >
          {/* Background Stage Lane Guides */}
          {lanes.map((lane) => (
            <g key={lane.name}>
              <line
                x1={lane.x}
                y1={45}
                x2={lane.x}
                y2={svgHeight - 20}
                stroke="#181820"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <text
                x={lane.x}
                y={28}
                textAnchor="middle"
                fill="#8E8E98"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                letterSpacing="0.04em"
              >
                {lane.name}
              </text>
            </g>
          ))}

          {/* Connection Trajectory Paths */}
          {filteredTracker.slice(0, 16).map((c) => {
            const isHovered = activeId === c.chunk_id;
            const isDimmed = Boolean(activeId && !isHovered);
            const strokeColor = getCandidateColor(c.parent_doc_id || c.chunk_id, isHovered);

            // Coordinates
            const yDense = c.dense_rank && c.dense_rank <= displayLimit ? 50 + c.dense_rank * rowHeight : null;
            const ySparse = c.sparse_rank && c.sparse_rank <= displayLimit ? 50 + c.sparse_rank * rowHeight : null;
            const yHybrid = c.hybrid_rank && c.hybrid_rank <= displayLimit ? 50 + c.hybrid_rank * rowHeight : null;
            const yRerank = c.reranked_rank && c.reranked_rank <= displayLimit ? 50 + c.reranked_rank * rowHeight : null;

            return (
              <g
                key={c.chunk_id}
                opacity={isDimmed ? 0.12 : 1}
                style={{ transition: 'opacity 0.2s ease-in-out' }}
                onMouseEnter={() => setHoveredId(c.chunk_id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelectedId(selectedId === c.chunk_id ? null : c.chunk_id)}
                className="cursor-pointer"
              >
                {/* Dense to Hybrid spline */}
                {yDense && yHybrid && (
                  <path
                    d={`M ${lanes[0].x} ${yDense} C ${(lanes[0].x + lanes[2].x) / 2} ${yDense}, ${(lanes[0].x + lanes[2].x) / 2} ${yHybrid}, ${lanes[2].x} ${yHybrid}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 2.5 : 1.2}
                    strokeOpacity={isHovered ? 0.95 : 0.4}
                  />
                )}

                {/* Sparse to Hybrid spline */}
                {ySparse && yHybrid && (
                  <path
                    d={`M ${lanes[1].x} ${ySparse} C ${(lanes[1].x + lanes[2].x) / 2} ${ySparse}, ${(lanes[1].x + lanes[2].x) / 2} ${yHybrid}, ${lanes[2].x} ${yHybrid}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 2.5 : 1.2}
                    strokeOpacity={isHovered ? 0.95 : 0.4}
                  />
                )}

                {/* Hybrid to Rerank spline */}
                {yHybrid && (
                  yRerank ? (
                    <path
                      d={`M ${lanes[2].x} ${yHybrid} C ${(lanes[2].x + lanes[3].x) / 2} ${yHybrid}, ${(lanes[2].x + lanes[3].x) / 2} ${yRerank}, ${lanes[3].x} ${yRerank}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isHovered ? 3 : 1.5}
                      strokeOpacity={isHovered ? 1 : 0.6}
                    />
                  ) : (
                    // Cut mark
                    <g>
                      <path
                        d={`M ${lanes[2].x} ${yHybrid} L ${lanes[2].x + 65} ${yHybrid}`}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth={isHovered ? 2 : 1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.65}
                      />
                      <text
                        x={lanes[2].x + 70}
                        y={yHybrid + 3}
                        fill="#EF4444"
                        fontSize={9}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        ✕ floor cut
                      </text>
                    </g>
                  )
                )}
              </g>
            );
          })}

          {/* Node Circles and Text Labels */}
          {lanes.map((lane) => (
            <g key={`nodes-${lane.name}`}>
              {lane.candidates.slice(0, displayLimit).map((cand, idx) => {
                const rank = idx + 1;
                const y = 50 + rank * rowHeight;
                const isHovered = activeId === cand.chunk_id;
                const isDimmed = Boolean(activeId && !isHovered);
                const color = getCandidateColor(cand.parent_doc_id, isHovered);

                return (
                  <g
                    key={`${lane.name}-${cand.chunk_id}-${rank}`}
                    opacity={isDimmed ? 0.2 : 1}
                    onMouseEnter={() => setHoveredId(cand.chunk_id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onOpenDoc(cand.parent_doc_id)}
                    className="cursor-pointer"
                  >
                    {/* Glowing outer ring when hovered */}
                    {isHovered && (
                      <circle
                        cx={lane.x}
                        cy={y}
                        r={7}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.5}
                        strokeOpacity={0.7}
                      />
                    )}

                    {/* Node circle */}
                    <circle
                      cx={lane.x}
                      cy={y}
                      r={isHovered ? 4.5 : 3.5}
                      fill={color}
                      stroke="#070709"
                      strokeWidth={1.5}
                    />

                    {/* Rank numeral */}
                    <text
                      x={lane.x - 12}
                      y={y + 3.5}
                      textAnchor="end"
                      fill={isHovered ? '#FFFFFF' : '#8E8E98'}
                      fontSize={10}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={isHovered ? 700 : 500}
                    >
                      #{rank}
                    </text>

                    {/* Identifier text */}
                    <text
                      x={lane.x + 10}
                      y={y + 3.5}
                      textAnchor="start"
                      fill={isHovered ? '#FFFFFF' : color}
                      fontSize={10}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={isHovered ? 700 : 500}
                    >
                      {cand.parent_doc_id.length > 18
                        ? cand.parent_doc_id.slice(0, 16) + '…'
                        : cand.parent_doc_id}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* Selected/Hovered Candidate Telemetry Card */}
      {activeItem ? (
        <div className="border border-border bg-surface-2 p-3.5 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-sm bg-surface-3 text-ink-primary border border-border font-bold">
                {activeItem.parent_doc_id}
              </span>
              <span className="font-sans font-semibold text-ink-primary">
                {activeItem.title}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-[11px] font-mono text-ink-muted">
              <span>Dense: <strong className="text-ink-primary font-normal font-tabular">{activeItem.dense_rank ? `#${activeItem.dense_rank}` : 'unranked'}</strong></span>
              <span>•</span>
              <span>Sparse: <strong className="text-ink-primary font-normal font-tabular">{activeItem.sparse_rank ? `#${activeItem.sparse_rank}` : 'unranked'}</strong></span>
              <span>•</span>
              <span>Hybrid: <strong className="text-attack font-normal font-tabular">{activeItem.hybrid_rank ? `#${activeItem.hybrid_rank}` : 'unranked'}</strong></span>
              <span>•</span>
              <span>Final: <strong className="text-valid font-normal font-tabular">{activeItem.reranked_rank ? `#${activeItem.reranked_rank}` : 'cut by floor'}</strong></span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenDoc(activeItem.parent_doc_id)}
          >
            Inspect Document &rarr;
          </Button>
        </div>
      ) : (
        <div className="text-[11px] font-mono text-ink-faint italic text-center py-1">
          Hover or click on any candidate to inspect its complete rank movement across all 4 pipeline stages.
        </div>
      )}
    </div>
  );
};
