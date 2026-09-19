import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QueryUnderstandingResponse } from '../types/api';
import { analyzeQueryUnderstanding } from '../api/client';

export interface ExtractedToken {
  type: 'cve' | 'attack' | 'cwe';
  value: string;
  start: number;
  end: number;
}

// Client-side regex patterns
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

    // CVE matches
    const cveReg = new RegExp(CVE_REGEX);
    while ((match = cveReg.exec(query)) !== null) {
      tokens.push({ type: 'cve', value: match[0], start: match.index, end: match.index + match[0].length });
    }

    // ATT&CK matches
    const attackReg = new RegExp(ATTACK_REGEX);
    while ((match = attackReg.exec(query)) !== null) {
      tokens.push({ type: 'attack', value: match[0], start: match.index, end: match.index + match[0].length });
    }

    // CWE matches
    const cweReg = new RegExp(CWE_REGEX);
    while ((match = cweReg.exec(query)) !== null) {
      tokens.push({ type: 'cwe', value: match[0], start: match.index, end: match.index + match[0].length });
    }

    tokens.sort((a, b) => a.start - b.start);
    return tokens;
  }, [query]);

  // Highlighted query token segments for in-situ visualization
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
      {/* Header */}
      <div className="border border-border bg-surface-1 p-5 space-y-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              Pipeline Stage 02
            </span>
            <span className="text-border text-xs">/</span>
            <h2 className="text-base font-serif font-semibold text-ink-primary">
              Live Query Understanding &amp; Deterministic Routing
            </h2>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Zero stochastic LLM rewriting: Instant client-side entity detection, domain acronym expansion, and identifier-based router dispatch.
          </p>
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono text-ink-muted uppercase tracking-wider">
            Curated Benchmark Queries:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuery(p.text)}
                className={`px-2 py-1 text-xs font-mono transition-colors border ${
                  query === p.text
                    ? 'bg-surface-3 text-ink-primary border-ink-primary font-medium'
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
              className="w-full px-3.5 py-3 bg-surface-2 border border-border text-ink-primary text-xs font-mono focus:outline-none focus:border-ink-primary"
            />
            <div className="absolute right-3 top-3 text-[11px] font-mono text-ink-faint flex items-center space-x-2">
              <span>{loading ? 'analyzing…' : 'live synchronized'}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-cve-warn animate-pulse' : 'bg-valid'}`} />
            </div>
          </div>

          {/* In-Situ Query Token Annotation Surface */}
          <div className="p-3 bg-[#0A0A0B] border border-border space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted flex items-center justify-between">
              <span>Live In-Situ Entity Token Parsing:</span>
              <span>{clientEntities.length} identifier{clientEntities.length === 1 ? '' : 's'} detected</span>
            </div>
            <div className="text-xs font-mono leading-relaxed break-words text-ink-primary min-h-[22px]">
              {highlightedSegments.map((seg, sIdx) => {
                if (!seg.token) {
                  return <span key={sIdx} className="text-ink-muted">{seg.text}</span>;
                }
                const isAtt = seg.token.type === 'attack';
                const isCve = seg.token.type === 'cve';
                return (
                  <span
                    key={sIdx}
                    className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded border text-[11px] font-bold ${
                      isAtt
                        ? 'bg-attack-surface text-attack-ink border-attack-border'
                        : isCve
                        ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
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

          {/* Controls */}
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

      {error && (
        <div className="p-3 border border-cve-crit/40 bg-surface-1 text-cve-crit text-xs font-mono">
          Query understanding error: {error}
        </div>
      )}

      {backendAnalysis && (
        <div className="space-y-6">
          {/* Entity Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CVE Identifiers */}
            <div className="border border-border bg-surface-1 p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-cve-warn">
                  Detected CVE IDs
                </span>
                <span className="font-mono text-xs text-ink-muted">
                  n={backendAnalysis.detected_cves.length}
                </span>
              </div>
              <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center">
                {backendAnalysis.detected_cves.length > 0 ? (
                  backendAnalysis.detected_cves.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/60 font-mono text-xs font-semibold"
                    >
                      {id}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-ink-faint italic font-mono">None detected</span>
                )}
              </div>
              <div className="text-[10px] text-ink-faint font-mono">
                Pattern: <code>\bCVE-\d&#123;4&#125;-\d&#123;4,7&#125;\b</code>
              </div>
            </div>

            {/* ATT&CK Identifiers */}
            <div className="border border-border bg-surface-1 p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-attack">
                  Detected ATT&amp;CK IDs
                </span>
                <span className="font-mono text-xs text-ink-muted">
                  n={backendAnalysis.detected_technique_ids.length}
                </span>
              </div>
              <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center">
                {backendAnalysis.detected_technique_ids.length > 0 ? (
                  backendAnalysis.detected_technique_ids.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded bg-attack-surface text-attack-ink border border-attack-border font-mono text-xs font-semibold"
                    >
                      {id}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-ink-faint italic font-mono">None detected</span>
                )}
              </div>
              <div className="text-[10px] text-ink-faint font-mono">
                Pattern: <code>\bT\d&#123;4&#125;(?:\.\d&#123;3&#125;)?\b</code>
              </div>
            </div>

            {/* CWE Identifiers */}
            <div className="border border-border bg-surface-1 p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                  Detected CWE IDs
                </span>
                <span className="font-mono text-xs text-ink-muted">
                  n={backendAnalysis.detected_cwes.length}
                </span>
              </div>
              <div className="min-h-[44px] flex flex-wrap gap-1.5 items-center">
                {backendAnalysis.detected_cwes.length > 0 ? (
                  backendAnalysis.detected_cwes.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded bg-surface-2 text-ink-primary border border-border font-mono text-xs font-semibold"
                    >
                      {id}
                    </span>
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

          {/* Acronym Expansion Details */}
          <div className="border border-border bg-surface-1 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-serif font-semibold text-sm text-ink-primary">
                Additive Acronym Expansion
              </h3>
              <span className="font-mono text-[11px] text-ink-muted">
                Curated Lexicon (10 key terms)
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="text-ink-muted">Expanded Query (Passed to index):</div>
              <div className="p-3 bg-[#0A0A0B] border border-border text-ink-primary break-words">
                {backendAnalysis.expanded_query}
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-ink-muted pt-1">
                <span>Injected expansion terms:</span>
                {backendAnalysis.expansion_terms.length > 0 ? (
                  <span className="text-valid font-medium">
                    {backendAnalysis.expansion_terms.join(', ')}
                  </span>
                ) : (
                  <span className="text-ink-faint italic">None matched</span>
                )}
              </div>
            </div>
          </div>

          {/* Router Decision & Negative Result Audit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Router Decision */}
            <div className="border border-border bg-surface-1 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="font-serif font-semibold text-sm text-ink-primary">
                  Router Decision (E4)
                </h3>
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 border ${
                    backendAnalysis.router_decision.selected_strategy === 'sparse'
                      ? 'bg-purple-950/40 text-purple-300 border-purple-800'
                      : 'bg-surface-2 text-ink-primary border-border'
                  }`}
                >
                  DISPATCH: {backendAnalysis.router_decision.selected_strategy.toUpperCase()}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2 font-mono text-ink-muted">
                  <span>Exact identifier present:</span>
                  <strong className={backendAnalysis.has_exact_identifier ? 'text-valid' : 'text-ink-faint'}>
                    {backendAnalysis.has_exact_identifier ? 'TRUE' : 'FALSE'}
                  </strong>
                </div>
                <p className="text-ink-muted font-sans leading-relaxed">
                  {backendAnalysis.router_decision.rationale}
                </p>
              </div>
            </div>

            {/* Negative Result Audit */}
            <div className="border border-cve-warn/40 bg-surface-1 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="font-serif font-semibold text-sm text-cve-warn">
                  Harmful Negative Result: Hard Auto-Filtering
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                  DISABLED BY RESEARCH FINDING
                </span>
              </div>

              <div className="space-y-2 text-xs text-ink-muted">
                <p className="leading-relaxed">
                  Hard auto-filtering on detected identifiers was evaluated in experiment E4 and definitively identified as a <strong>harmful negative result</strong> (DEV Recall@5 degraded by -0.0446, <span className="font-mono text-cve-warn font-semibold">p=0.0253</span>).
                </p>
                <div className="p-2.5 bg-[#0A0A0B] border border-cve-warn/30 font-mono text-[11px] text-amber-200/90 leading-relaxed">
                  Collisions occur when cross-corpus queries mention both a CVE and an ATT&CK technique, or when natural text accidentally matches an ID pattern, erroneously filtering out true positives.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
