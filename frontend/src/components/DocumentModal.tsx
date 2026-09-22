import React, { useEffect, useState, useRef } from 'react';
import { DocumentResponse } from '../types/api';
import { fetchDocument } from '../api/client';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

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
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!docId || !docId.trim()) {
      if (docId !== null) {
        setTimeout(() => {
          setError({
            title: 'Invalid Document Identifier',
            message: 'The requested document ID is empty or invalid.',
          });
        }, 0);
      }
      return;
    }
    const cleanId = docId.trim();
    let cancelled = false;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      setActiveChunkIndex(0);

      try {
        const data = await fetchDocument(cleanId);
        if (!cancelled) {
          setDoc(data);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const errObj = err as Error & { status?: number };
          const status = errObj.status;
          const msg = errObj.message || '';
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
      }
    };

    loadDocument();

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-surface-1 border border-border-strong rounded-sm overflow-hidden shadow-2xl"
      >
        {/* Dossier Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#09090C]">
          <div className="space-y-1 min-w-0 pr-4">
            <div className="flex items-center space-x-2">
              <Badge variant={isAttack ? 'attack' : isCve ? 'cve' : 'default'} size="sm">
                {docId}
              </Badge>
              {doc && (
                <span className="text-xs font-mono text-ink-faint">
                  ({doc.total_chunks} {doc.total_chunks === 1 ? 'chunk' : 'chunks'})
                </span>
              )}
            </div>
            <h2
              id="document-modal-title"
              className="text-base font-serif font-semibold text-ink-primary truncate"
            >
              {doc?.title || 'Retrieving document record…'}
            </h2>
          </div>

          <div className="flex items-center space-x-3 flex-shrink-0">
            {doc?.url && (
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-attack hover:underline hidden sm:inline"
              >
                External source &rarr;
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close document modal"
              className="px-2.5 py-1 font-mono text-xs text-ink-muted hover:text-ink-primary border border-border bg-surface-2 rounded-sm cursor-pointer"
            >
              ✕ esc
            </button>
          </div>
        </div>

        {/* Modal Body with Archival Evidence Paper */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-20 text-xs font-mono text-ink-muted space-x-2.5">
              <div className="w-4 h-4 border-2 border-attack border-t-transparent animate-spin rounded-full" />
              <span>Fetching chunks from Qdrant vector store…</span>
            </div>
          )}

          {error && (
            <div className="p-4 border border-red-800/60 bg-red-950/20 text-xs font-mono rounded-sm space-y-2">
              <div className="flex items-center space-x-2 text-red-400 font-bold uppercase tracking-wider">
                <span className="inline-block w-2 h-2 bg-red-400 rounded-full" />
                <span>{error.title}</span>
              </div>
              <p className="text-ink-primary font-sans text-sm">
                {error.message}
              </p>
              {error.details && (
                <div className="text-[11px] text-ink-faint font-mono bg-surface-1 p-2.5 border border-border rounded-sm">
                  Server detail: {error.details}
                </div>
              )}
            </div>
          )}

          {doc && (
            <div className="space-y-6">
              {/* Provenance Metadata bar */}
              <div className="flex flex-wrap gap-4 text-xs font-mono text-ink-muted p-3.5 bg-surface-2 border border-border rounded-sm">
                <div>Source: <strong className="text-ink-primary font-normal">{doc.source}</strong></div>
                <div>Type: <strong className="text-ink-primary font-normal">{doc.document_type}</strong></div>
                <div>Document ID: <strong className="text-ink-primary font-normal">{doc.doc_id}</strong></div>
                <div>Indexed Chunks: <strong className="text-attack font-normal font-tabular">{doc.chunks.length}</strong></div>
              </div>

              {/* Chunk Quick Navigation Timeline */}
              {doc.chunks.length > 1 && (
                <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
                  <span className="text-[10px] font-mono text-ink-faint uppercase mr-1 flex-shrink-0">
                    Jump to Chunk:
                  </span>
                  {doc.chunks.map((chunk, idx) => (
                    <button
                      key={chunk.chunk_id}
                      type="button"
                      onClick={() => setActiveChunkIndex(idx)}
                      className={`px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors cursor-pointer flex-shrink-0 ${
                        activeChunkIndex === idx
                          ? 'bg-surface-3 text-ink-primary border-attack font-bold shadow-sm'
                          : 'bg-surface-2 text-ink-muted border-border hover:border-border-strong'
                      }`}
                    >
                      #{chunk.chunk_index}
                    </button>
                  ))}
                </div>
              )}

              {/* Chunks listed on warm archival paper surfaces */}
              <div className="space-y-4">
                <div className="font-mono text-xs uppercase tracking-wider text-ink-faint flex items-center justify-between border-b border-border pb-1.5">
                  <span>Indexed Forensic Chunks ({doc.chunks.length})</span>
                  <span>Max 512 tokens / 64 token overlap</span>
                </div>

                {doc.chunks.map((chunk, idx) => (
                  <div
                    key={chunk.chunk_id}
                    className={`evidence-paper p-5 border rounded-sm space-y-2.5 text-paper-ink font-sans transition-all ${
                      activeChunkIndex === idx ? 'ring-2 ring-attack/70 shadow-lg' : ''
                    }`}
                  >
                    <div className="evidence-paper-header pb-2 flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-paper-ink">
                        Chunk #{chunk.chunk_index} {chunk.section ? `• ${chunk.section}` : ''}
                      </span>
                      <span className="text-paper-muted text-[11px] font-mono">
                        {chunk.chunk_id}
                      </span>
                    </div>

                    <div className="text-sm font-serif leading-relaxed whitespace-pre-wrap text-paper-ink pt-1 selection:bg-paper-border">
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

        {/* Dossier Footer */}
        <div className="px-6 py-3 border-t border-border bg-[#09090C] flex items-center justify-between text-xs font-mono text-ink-muted">
          <span className="text-ink-faint">Corpus SHA256 Verified Grounding Dossier</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Dossier
          </Button>
        </div>
      </div>
    </div>
  );
};
