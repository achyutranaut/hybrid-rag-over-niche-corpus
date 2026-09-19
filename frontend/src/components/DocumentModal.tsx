import React, { useEffect, useState, useRef } from 'react';
import { DocumentResponse } from '../types/api';
import { fetchDocument } from '../api/client';

interface DocumentModalProps {
  docId: string | null;
  onClose: () => void;
}

interface ErrorInfo {
  title: string;
  message: string;
  details?: string;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({ docId, onClose }) => {
  const [doc, setDoc] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!docId || !docId.trim()) {
      if (docId !== null) {
        setError({
          title: 'Invalid Document Identifier',
          message: 'The requested document ID is empty or invalid.',
        });
      }
      return;
    }
    const cleanId = docId.trim();
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDocument(cleanId)
      .then((data) => {
        if (!cancelled) {
          setDoc(data);
          setLoading(false);
        }
      })
      .catch((err: Error & { status?: number }) => {
        if (!cancelled) {
          const status = err.status;
          const msg = err.message || '';
          if (status === 404 || msg.toLowerCase().includes('not found') || msg.includes('404')) {
            setError({
              title: 'Document Not Found (404)',
              message: `Document "${cleanId}" could not be located in the Qdrant index.`,
              details: msg,
            });
          } else if (status === 500 || msg.toLowerCase().includes('internal server') || msg.includes('500')) {
            setError({
              title: 'Backend Server Error (500)',
              message: 'The backend service encountered an internal error while querying Qdrant.',
              details: msg,
            });
          } else if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
            setError({
              title: 'Network Communication Error',
              message: 'Unable to connect to the backend server. Verify the API is running at /api/v1.',
              details: msg,
            });
          } else {
            setError({
              title: 'Retrieval Error',
              message: msg || 'An unknown error occurred while retrieving document details.',
            });
          }
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Handle ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (docId) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docId, onClose]);

  if (!docId) return null;

  const isAttack = docId.startsWith('attack:') || docId.startsWith('T');
  const isCve = docId.startsWith('cve:') || docId.startsWith('CVE');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-surface-1 border border-border overflow-hidden shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#0D0D0F]">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span
                className={`font-mono text-xs px-2 py-0.5 rounded-sm border font-semibold ${
                  isAttack
                    ? 'bg-attack-surface text-attack-ink border-attack-border'
                    : isCve
                    ? 'bg-amber-950/50 text-amber-300 border-amber-800'
                    : 'bg-surface-2 text-ink-primary border-border'
                }`}
              >
                {docId}
              </span>
              {doc && (
                <span className="text-xs font-mono text-ink-muted">
                  ({doc.total_chunks} {doc.total_chunks === 1 ? 'chunk' : 'chunks'})
                </span>
              )}
            </div>
            <h2
              id="document-modal-title"
              className="text-base font-serif font-semibold text-ink-primary"
            >
              {doc?.title || 'Retrieving document record…'}
            </h2>
          </div>

          <div className="flex items-center space-x-3">
            {doc?.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-ink-muted hover:text-ink-primary underline"
              >
                External source &rarr;
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document modal"
              className="p-1 px-2 font-mono text-xs text-ink-muted hover:text-ink-primary border border-border bg-surface-2"
            >
              ✕ esc
            </button>
          </div>
        </div>

        {/* Modal Body with Warm Evidence Paper Styling */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-xs font-mono text-ink-muted space-x-2">
              <div className="w-3.5 h-3.5 border-2 border-ink-primary border-t-transparent animate-spin" />
              <span>Fetching chunks from Qdrant vector store…</span>
            </div>
          )}

          {error && (
            <div className="p-4 border border-cve-crit/60 bg-[#160b0b] text-xs font-mono space-y-2">
              <div className="flex items-center space-x-2 text-cve-crit font-bold uppercase tracking-wider">
                <span className="inline-block w-2 h-2 bg-cve-crit rounded-full" />
                <span>{error.title}</span>
              </div>
              <p className="text-ink-primary font-sans text-sm">
                {error.message}
              </p>
              {error.details && (
                <div className="text-[11px] text-ink-muted font-mono bg-surface-1 p-2 border border-border">
                  Server detail: {error.details}
                </div>
              )}
            </div>
          )}

          {doc && (
            <div className="space-y-6">
              {/* Provenance Metadata bar */}
              <div className="flex flex-wrap gap-4 text-xs font-mono text-ink-muted p-3 bg-surface-2 border border-border">
                <div>Source: <strong className="text-ink-primary font-normal">{doc.source}</strong></div>
                <div>Type: <strong className="text-ink-primary font-normal">{doc.document_type}</strong></div>
                <div>Document ID: <strong className="text-ink-primary font-normal">{doc.doc_id}</strong></div>
              </div>

              {/* Chunks listed on warm archival paper surfaces */}
              <div className="space-y-4">
                <div className="font-mono text-xs uppercase tracking-wider text-ink-muted flex items-center justify-between border-b border-border pb-1">
                  <span>Indexed Forensic Chunks ({doc.chunks.length})</span>
                  <span>Max 512 tokens / 64 token overlap</span>
                </div>

                {doc.chunks.map((chunk) => (
                  <div
                    key={chunk.chunk_id}
                    className="evidence-paper p-5 border border-paper-border space-y-2 text-paper-ink font-sans"
                  >
                    <div className="evidence-paper-header pb-2 flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-paper-ink">
                        Chunk #{chunk.chunk_index} {chunk.section ? `• ${chunk.section}` : ''}
                      </span>
                      <span className="text-paper-muted text-[11px] font-mono">
                        {chunk.chunk_id}
                      </span>
                    </div>

                    <div className="text-sm font-serif leading-relaxed whitespace-pre-wrap text-paper-ink pt-1">
                      {chunk.text}
                    </div>

                    {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                      <div className="pt-2 border-t border-paper-border/60 text-[11px] font-mono text-paper-muted flex flex-wrap gap-2">
                        {Object.entries(chunk.metadata).map(([k, v]) => (
                          <span key={k}>
                            {k}: <code>{String(v)}</code>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border bg-[#0D0D0F] flex items-center justify-between text-xs font-mono text-ink-muted">
          <span>Corpus SHA256 Verified Grounding</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-surface-2 hover:bg-border text-ink-primary border border-border transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};
