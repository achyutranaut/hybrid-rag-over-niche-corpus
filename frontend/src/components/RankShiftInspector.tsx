import React, { useState, useMemo } from 'react';
import { RankTrackerItem, RetrievedCandidate } from '../types/api';

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

  const activeId = selectedId || hoveredId;

  // Find candidate pools limits
  const maxRanks = Math.max(
    denseCandidates.length,
    sparseCandidates.length,
    hybridCandidates.length,
    rerankedCandidates.length,
    8
  );

  const displayLimit = Math.min(maxRanks, 10);
  const rowHeight = 38;
  const svgHeight = 60 + displayLimit * rowHeight + 30;
  const svgWidth = 920;

  // Rail X positions
  const lanes = [
    { name: '1. Dense (LSA)', x: 120, key: 'dense_rank' as const, candidates: denseCandidates },
    { name: '2. Sparse (BM25)', x: 360, key: 'sparse_rank' as const, candidates: sparseCandidates },
    { name: '3. Hybrid RRF (k=60)', x: 600, key: 'hybrid_rank' as const, candidates: hybridCandidates },
    { name: '4. Reranked', x: 820, key: 'reranked_rank' as const, candidates: rerankedCandidates },
  ];

  // Candidates mapped to positions
  const candidateMap = useMemo(() => {
    const map = new Map<string, RankTrackerItem>();
    rankTracker.forEach((item) => {
      map.set(item.chunk_id, item);
    });
    return map;
  }, [rankTracker]);

  // Selected or active item details
  const activeItem = activeId ? candidateMap.get(activeId) : null;

  const isAttack = (id?: string) => id?.startsWith('attack:') || id?.startsWith('T');
  const isCve = (id?: string) => id?.startsWith('cve:') || id?.startsWith('CVE');

  const getCandidateColor = (id: string, isHovered: boolean) => {
    if (isHovered) return '#F5F3EE';
    if (isAttack(id)) return '#8B7EF8';
    if (isCve(id)) return '#F59E0B';
    return '#9A9A9F';
  };

  return (
    <div className="border border-border bg-surface-1 p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-border pb-3 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              Pipeline Flow Visualizer
            </span>
            <span className="text-border text-xs">/</span>
            <span className="font-sans font-semibold text-sm text-ink-primary">
              Candidate Trajectory &amp; Rank-Shift Funnel
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Trace how documents move from Dense (LSA) and Sparse (BM25) through Reciprocal Rank Fusion into the final Reranked pool.
          </p>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-attack" />
            <span className="text-ink-muted">ATT&amp;CK</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cve-warn" />
            <span className="text-ink-muted">CVE</span>
          </div>
          <div className="text-ink-faint hidden sm:inline">
            Hover any node to isolate trajectory
          </div>
        </div>
      </div>

      {/* SVG Slope / Trajectory Canvas */}
      <div className="relative overflow-x-auto bg-[#0A0A0B] border border-border p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[760px] select-none"
          role="img"
          aria-label="Candidate rank shift diagram across retrieval stages"
        >
          {/* Background Stage Lane Guides */}
          {lanes.map((lane) => (
            <g key={lane.name}>
              {/* Lane Rail */}
              <line
                x1={lane.x}
                y1={45}
                x2={lane.x}
                y2={svgHeight - 20}
                stroke="#1C1C1F"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              {/* Column Header */}
              <text
                x={lane.x}
                y={28}
                textAnchor="middle"
                fill="#9A9A9F"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                letterSpacing="0.04em"
              >
                {lane.name}
              </text>
            </g>
          ))}

          {/* Connection Paths */}
          {rankTracker.slice(0, 16).map((c) => {
            const isHovered = activeId === c.chunk_id;
            const isDimmed = Boolean(activeId && !isHovered);
            const strokeColor = getCandidateColor(c.parent_doc_id || c.chunk_id, isHovered);

            // Coordinates
            const yDense = c.dense_rank && c.dense_rank <= displayLimit ? 50 + c.dense_rank * rowHeight : null;
            const ySparse = c.sparse_rank && c.sparse_rank <= displayLimit ? 50 + c.sparse_rank * rowHeight : null;
            const yHybrid = c.hybrid_rank && c.hybrid_rank <= displayLimit ? 50 + c.hybrid_rank * rowHeight : null;
            const yRerank = c.reranked_rank && c.reranked_rank <= displayLimit ? 50 + c.reranked_rank * rowHeight : null;

            // Generate paths:
            // Segment 1: Dense -> Hybrid
            // Segment 2: Sparse -> Hybrid
            // Segment 3: Hybrid -> Rerank (or cut mark)
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
                {/* Dense to Hybrid link */}
                {yDense && yHybrid && (
                  <path
                    d={`M ${lanes[0].x} ${yDense} C ${(lanes[0].x + lanes[2].x) / 2} ${yDense}, ${(lanes[0].x + lanes[2].x) / 2} ${yHybrid}, ${lanes[2].x} ${yHybrid}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 2.5 : 1.2}
                    strokeOpacity={isHovered ? 0.95 : 0.4}
                  />
                )}

                {/* Sparse to Hybrid link */}
                {ySparse && yHybrid && (
                  <path
                    d={`M ${lanes[1].x} ${ySparse} C ${(lanes[1].x + lanes[2].x) / 2} ${ySparse}, ${(lanes[1].x + lanes[2].x) / 2} ${yHybrid}, ${lanes[2].x} ${yHybrid}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHovered ? 2.5 : 1.2}
                    strokeOpacity={isHovered ? 0.95 : 0.4}
                  />
                )}

                {/* Hybrid to Rerank link */}
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
                    // Cut by relevance floor or rerank limit
                    <g>
                      <path
                        d={`M ${lanes[2].x} ${yHybrid} L ${lanes[2].x + 70} ${yHybrid}`}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth={isHovered ? 2 : 1}
                        strokeDasharray="3 3"
                        strokeOpacity={0.6}
                      />
                      <text
                        x={lanes[2].x + 75}
                        y={yHybrid + 3}
                        fill="#EF4444"
                        fontSize={9}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        ✕ cut
                      </text>
                    </g>
                  )
                )}
              </g>
            );
          })}

          {/* Node Circles and Labels for each Lane */}
          {lanes.map((lane) => {
            return (
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
                      {/* Node point */}
                      <circle
                        cx={lane.x}
                        cy={y}
                        r={isHovered ? 5.5 : 3.5}
                        fill={color}
                        stroke="#0A0A0B"
                        strokeWidth={1.5}
                      />

                      {/* Rank tag */}
                      <text
                        x={lane.x - 12}
                        y={y + 3.5}
                        textAnchor="end"
                        fill={isHovered ? '#F5F3EE' : '#9A9A9F'}
                        fontSize={10}
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight={isHovered ? 700 : 500}
                      >
                        #{rank}
                      </text>

                      {/* Document ID label */}
                      <text
                        x={lane.x + 10}
                        y={y + 3.5}
                        textAnchor="start"
                        fill={isHovered ? '#F5F3EE' : color}
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
            );
          })}
        </svg>
      </div>

      {/* Interactive Active Candidate Trajectory Card */}
      {activeItem ? (
        <div className="border border-border bg-surface-2 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-3 text-ink-primary border border-border">
                {activeItem.parent_doc_id}
              </span>
              <span className="font-sans font-semibold text-ink-primary">
                {activeItem.title}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-[11px] font-mono text-ink-muted">
              <span>Dense: <strong className="text-ink-primary font-normal">{activeItem.dense_rank ? `#${activeItem.dense_rank}` : 'unranked'}</strong></span>
              <span>•</span>
              <span>Sparse: <strong className="text-ink-primary font-normal">{activeItem.sparse_rank ? `#${activeItem.sparse_rank}` : 'unranked'}</strong></span>
              <span>•</span>
              <span>Hybrid: <strong className="text-attack font-normal">{activeItem.hybrid_rank ? `#${activeItem.hybrid_rank}` : 'unranked'}</strong></span>
              <span>•</span>
              <span>Final Rerank: <strong className="text-valid font-normal">{activeItem.reranked_rank ? `#${activeItem.reranked_rank}` : 'cut by floor'}</strong></span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenDoc(activeItem.parent_doc_id)}
            className="px-3 py-1 text-xs font-mono rounded bg-surface-3 hover:bg-border text-ink-primary border border-border transition-colors flex-shrink-0"
          >
            Inspect Document &rarr;
          </button>
        </div>
      ) : (
        <div className="text-[11px] font-mono text-ink-faint italic text-center py-1">
          Hover or click on any candidate to view its trajectory through dense, sparse, fusion, and reranking.
        </div>
      )}
    </div>
  );
};
