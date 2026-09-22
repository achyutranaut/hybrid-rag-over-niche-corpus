import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QueryUnderstandingResponse } from '../types/api';
import { analyzeQueryUnderstanding } from '../api/client';
import { Badge } from './ui/Badge';
import { Panel } from './ui/Panel';

export interface ExtractedToken {
  type: 'cve' | 'attack' | 'cwe';
  value: string;
  start: number;
  end: number;
}

// Deterministic regex patterns matching backend specifications
const CVE_REGEX = /\bCVE-\d{4}-\d{4,7}\b/gi;
const ATTACK_REGEX = /\bT\d{4}(?:\.\d{3})?\b/gi;
const CWE_REGEX = /\bCWE-\d+\b/gi;

export const QueryUnderstandingView: React.FC = () => {
  const [query, setQuery] = useState(
    'What is CVE-2021-44228 and how does it relate to credential dumping (T1003) and CWE-79?'
  );
  const [enableAcronymExpansion, setEnableAcronymExpansion] = useState(true);
  const [router, setRouter] = useState(true);

  const [loading, setLoading] = useState(false);
  const [backendAnalysis, setBackendAnalysis] = useState<QueryUnderstandingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presets = [
    {
      label: 'CVE-2021-44228 + T1003 + CWE-79',
      text: 'What is CVE-2021-44228 and how does it relate to credential dumping (T1003) and CWE-79?',
    },
    {
      label: 'Domain Acronyms (LSASS, RCE, MSHTA)',
      text: 'Techniques for RCE via MSHTA and credential dumping with LSASS injection',
    },
    {
      label: 'Conceptual Phrasing (No Identifiers)',
      text: 'How do threat actors execute scripts silently inside Microsoft Office documents?',
    },
    {
      label: 'Subtechnique Dotted Identifier',
      text: 'Explain T1059.001 execution mechanics and detection indicators in detail',
    },
  ];

  // 1. Instant Client-Side Parsing
  const clientEntities = useMemo(() => {
    const tokens: ExtractedToken[] = [];
    let match: RegExpExecArray | null;

    const cveReg = new RegExp(CVE_REGEX);
    while ((match = cveReg.exec(query)) !== null) {
      tokens.push({ type: 'cve', value: match[0], start: match.index, end: match.index + match[0].length });
    }

    const attackReg = new RegExp(ATTACK_REGEX);
    while ((match = attackReg.exec(query)) !== null) {
      tokens.push({ type: 'attack', value: match[0], start: match.index, end: match.index + match[0].length });
    }

    const cweReg = new RegExp(CWE_REGEX);
    while ((match = cweReg.exec(query)) !== null) {
      tokens.push({ type: 'cwe', value: match[0], start: match.index, end: match.index + match[0].length });
    }

    tokens.sort((a, b) => a.start - b.start);
    return tokens;
  }, [query]);

  // In-situ annotated query segments
  const highlightedSegments = useMemo(() => {
    if (!query) return [];
    if (clientEntities.length === 0) {
      return [{ text: query, token: null }];
    }

    const segments: { text: string; token: ExtractedToken | null }[] = [];
    let cursor = 0;

    for (const ent of clientEntities) {
      if (ent.start > cursor) {
        segments.push({ text: query.slice(cursor, ent.start), token: null });
      }
      segments.push({ text: query.slice(ent.start, ent.end), token: ent });
      cursor = ent.end;
    }

    if (cursor < query.length) {
      segments.push({ text: query.slice(cursor), token: null });
    }

    return segments;
  }, [query, clientEntities]);

  // 2. Debounced Backend Query Understanding
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        setBackendAnalysis(null);
        setLoading(false);
      }, 0);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await analyzeQueryUnderstanding({
          query: query.trim(),
          enable_acronym_expansion: enableAcronymExpansion,
          router,
        });
        setBackendAnalysis(resp);
        setError(null);
      } catch (err: unknown) {
        setError((err as Error).message || 'Query analysis failed');
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, enableAcronymExpansion, router]);

  return (
    <div className="space-y-6">
      {/* Control Console */}
      <Panel
        header={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <Badge variant="attack" size="sm">
                Stage 02
              </Badge>
              <span className="text-border text-xs">/</span>
              <h2 className="text-sm font-serif font-semibold text-ink-primary">
                Live Query Understanding &amp; Deterministic Routing
              </h2>
            </div>
            <span className="font-mono text-[11px] text-ink-faint hidden sm:inline">
              Zero Stochastic LLM Rewriting
            </span>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted leading-relaxed">
            Deterministic token parsing: Instant client-side entity detection, domain acronym expansion, and identifier-based router dispatch (E4).
          </p>

          {/* Benchmark Preset Buttons */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">
              Curated Benchmark Archetypes:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQuery(p.text)}
                  className={`px-2.5 py-1 text-xs font-mono transition-colors border rounded-sm cursor-pointer ${
                    query === p.text
                      ? 'bg-surface-3 text-ink-primary border-ink-primary font-semibold shadow-glow-sm'
                      : 'bg-surface-2 text-ink-muted border-border hover:border-border-strong hover:text-ink-primary'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Query Input */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type or paste query with CVEs, ATT&CK techniques, or security terminology..."
                className="w-full px-3.5 py-3 bg-surface-2 border border-border text-ink-primary text-xs font-mono rounded-sm focus:outline-none focus:border-ink-primary transition-colors"
              />
              <div className="absolute right-3 top-3 text-[11px] font-mono text-ink-faint flex items-center space-x-2">
                <span>{loading ? 'analyzing…' : 'live synchronized'}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-cve-warn animate-pulse' : 'bg-valid'}`} />
              </div>
            </div>

            {/* In-Situ Query Token Annotation Surface */}
            <div className="p-3 bg-[#08080A] border border-border rounded-sm space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint flex items-center justify-between">
                <span>Live In-Situ Token Extraction:</span>
                <span className="text-ink-muted">{clientEntities.length} identifier{clientEntities.length === 1 ? '' : 's'} detected</span>
              </div>
              <div className="text-xs font-mono leading-relaxed break-words text-ink-primary min-h-[24px]">
                {highlightedSegments.map((seg, sIdx) => {
                  if (!seg.token) {
                    return <span key={sIdx} className="text-ink-muted">{seg.text}</span>;
                  }
                  const isAtt = seg.token.type === 'attack';
                  const isCve = seg.token.type === 'cve';
                  return (
                    <span
                      key={sIdx}
                      className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-sm border text-[11px] font-bold ${
                        isAtt
                          ? 'bg-attack-surface text-attack-ink border-attack-border'
                          : isCve
                          ? 'bg-cve-surface text-cve-ink border-cve-border'
                          : 'bg-purple-950/40 text-purple-300 border-purple-800/60'
                      }`}
                    >
                      <span className="text-[9px] font-mono opacity-70 mr-1 uppercase">
                        {seg.token.type}
                      </span>
                      {seg.text}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Strategy Switches */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-mono text-ink-muted border-t border-border">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={router}
                  onChange={(e) => setRouter(e.target.checked)}
                  className="rounded-none bg-surface-2 border-border text-ink-primary focus:ring-0"
                />
                <span className="text-ink-primary">Identifier Router (E4)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAcronymExpansion}
                  onChange={(e) => setEnableAcronymExpansion(e.target.checked)}
                  className="rounded-none bg-surface-2 border-border text-ink-primary focus:ring-0"
                />
                <span className="text-ink-primary">Acronym Expansion (Curated Glossary)</span>
              </label>
            </div>
          </div>
        </div>
      </Panel>

      {error && (
        <div className="p-3.5 border border-red-800/60 bg-red-950/20 text-red-300 text-xs font-mono rounded-sm flex items-center space-x-2">
          <span className="text-red-400 font-bold">✕ Error:</span>
          <span>{error}</span>
        </div>
      )}

      {backendAnalysis && (
        <div className="space-y-6">
          {/* Entity Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Detected CVEs */}
            <div className="border border-border bg-surface-1 p-4 rounded-sm space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-cve-warn font-semibold">
                  Detected CVE IDs
                </span>
                <span className="font-mono text-xs text-ink-faint font-tabular">
                  n={backendAnalysis.detected_cves.length}
                </span>
              </div>
              <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center">
                {backendAnalysis.detected_cves.length > 0 ? (
                  backendAnalysis.detected_cves.map((id) => (
                    <Badge key={id} variant="cve" size="sm">
                      {id}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-ink-faint italic font-mono">None detected</span>
                )}
              </div>
              <div className="text-[10px] text-ink-faint font-mono">
                Pattern: <code>\bCVE-\d&#123;4&#125;-\d&#123;4,7&#125;\b</code>
              </div>
            </div>

            {/* Detected ATT&CK IDs */}
            <div className="border border-border bg-surface-1 p-4 rounded-sm space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-attack font-semibold">
                  Detected ATT&amp;CK IDs
                </span>
                <span className="font-mono text-xs text-ink-faint font-tabular">
                  n={backendAnalysis.detected_technique_ids.length}
                </span>
              </div>
              <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center">
                {backendAnalysis.detected_technique_ids.length > 0 ? (
                  backendAnalysis.detected_technique_ids.map((id) => (
                    <Badge key={id} variant="attack" size="sm">
                      {id}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-ink-faint italic font-mono">None detected</span>
                )}
              </div>
              <div className="text-[10px] text-ink-faint font-mono">
                Pattern: <code>\bT\d&#123;4&#125;(?:\.\d&#123;3&#125;)?\b</code>
              </div>
            </div>

            {/* Detected CWE IDs */}
            <div className="border border-border bg-surface-1 p-4 rounded-sm space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-muted font-semibold">
                  Detected CWE IDs
                </span>
                <span className="font-mono text-xs text-ink-faint font-tabular">
                  n={backendAnalysis.detected_cwes.length}
                </span>
              </div>
              <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center">
                {backendAnalysis.detected_cwes.length > 0 ? (
                  backendAnalysis.detected_cwes.map((id) => (
                    <Badge key={id} variant="neutral" size="sm">
                      {id}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-ink-faint italic font-mono">None detected</span>
                )}
              </div>
              <div className="text-[10px] text-ink-faint font-mono">
                Pattern: <code>\bCWE-\d+\b</code>
              </div>
            </div>
          </div>

          {/* Acronym Expansion Panel */}
          <Panel
            header={
              <div className="flex items-center justify-between w-full">
                <h3 className="font-serif font-semibold text-sm text-ink-primary">
                  Additive Acronym Expansion
                </h3>
                <span className="font-mono text-[11px] text-ink-faint">
                  Curated Lexicon (10 key security terms)
                </span>
              </div>
            }
          >
            <div className="space-y-2.5 text-xs font-mono">
              <div className="text-ink-faint uppercase text-[10px]">Expanded Query (Dispatched to Index):</div>
              <div className="p-3 bg-[#08080A] border border-border rounded-sm text-ink-primary break-words leading-relaxed">
                {backendAnalysis.expanded_query}
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-ink-muted pt-1">
                <span>Injected expansion terms:</span>
                {backendAnalysis.expansion_terms.length > 0 ? (
                  <span className="text-valid font-medium">
                    {backendAnalysis.expansion_terms.join(', ')}
                  </span>
                ) : (
                  <span className="text-ink-faint italic">None matched in query</span>
                )}
              </div>
            </div>
          </Panel>

          {/* Router Decision & Negative Result Audit Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Router Decision */}
            <Panel
              header={
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-serif font-semibold text-sm text-ink-primary">
                    Deterministic Router Decision (E4)
                  </h3>
                  <Badge
                    variant={backendAnalysis.router_decision.selected_strategy === 'sparse' ? 'cve' : 'default'}
                    size="sm"
                  >
                    DISPATCH: {backendAnalysis.router_decision.selected_strategy.toUpperCase()}
                  </Badge>
                </div>
              }
            >
              <div className="space-y-3 text-xs">
                <div className="flex items-center space-x-2 font-mono text-ink-muted">
                  <span>Exact alphanumeric identifier present:</span>
                  <strong className={backendAnalysis.has_exact_identifier ? 'text-valid' : 'text-ink-faint'}>
                    {backendAnalysis.has_exact_identifier ? 'TRUE' : 'FALSE'}
                  </strong>
                </div>
                <p className="text-ink-muted font-sans leading-relaxed">
                  {backendAnalysis.router_decision.rationale}
                </p>
              </div>
            </Panel>

            {/* Negative Result Audit */}
            <Panel
              header={
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-serif font-semibold text-sm text-cve-warn">
                    Harmful Negative Result: Hard Auto-Filtering
                  </h3>
                  <Badge variant="warn" size="sm">
                    DISABLED BY FINDING
                  </Badge>
                </div>
              }
            >
              <div className="space-y-2.5 text-xs text-ink-muted">
                <p className="leading-relaxed">
                  Hard auto-filtering on detected identifiers was evaluated in experiment E4 and definitively identified as a <strong>harmful negative result</strong> (DEV Recall@5 degraded by -0.0446, <span className="font-mono text-cve-warn font-semibold">p=0.0253</span>).
                </p>
                <div className="p-3 bg-[#08080A] border border-cve-warn/30 rounded-sm font-mono text-[11px] text-amber-200/90 leading-relaxed">
                  Collisions occur when cross-corpus queries mention both a CVE and an ATT&amp;CK technique, or when natural text accidentally matches an ID pattern, erroneously filtering out true positives.
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
};
