import React, { useState, useEffect } from 'react';
import { Navbar, TabId } from './components/Navbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { RagPlayground } from './components/RagPlayground';
import { RetrievalInspector } from './components/RetrievalInspector';
import { QueryUnderstandingView } from './components/QueryUnderstandingView';
import { EvaluationDashboard } from './components/EvaluationDashboard';
import { ArchitectureView } from './components/ArchitectureView';
import { MethodologyView } from './components/MethodologyView';
import { DocumentModal } from './components/DocumentModal';
import { OverviewResponse } from './types/api';
import { fetchHealth, fetchOverview } from './api/client';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  useEffect(() => {
    const checkSystem = async () => {
      try {
        const health = await fetchHealth();
        if (health.status === 'ok') {
          setBackendOnline(true);
          const ov = await fetchOverview();
          setOverview(ov);
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }
    };

    checkSystem();
    const interval = setInterval(checkSystem, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex flex-col font-sans selection:bg-surface-3 selection:text-ink-primary lab-grid-bg relative">
      <div className="absolute inset-0 lab-vignette pointer-events-none" />

      {/* Top Scientific Masthead & Sequential Pipeline Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        overview={overview}
        backendOnline={backendOnline}
      />

      {/* Main Research Console Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
        {activeTab === 'overview' && (
          <OverviewDashboard overview={overview} onNavigate={setActiveTab} />
        )}
        {activeTab === 'playground' && (
          <RagPlayground onOpenDoc={(docId) => setActiveDocId(docId)} />
        )}
        {activeTab === 'inspector' && (
          <RetrievalInspector onOpenDoc={(docId) => setActiveDocId(docId)} />
        )}
        {activeTab === 'query_understanding' && (
          <QueryUnderstandingView />
        )}
        {activeTab === 'evaluation' && (
          <EvaluationDashboard />
        )}
        {activeTab === 'architecture' && (
          <ArchitectureView />
        )}
        {activeTab === 'methodology' && (
          <MethodologyView />
        )}
      </main>

      {/* Forensic Document Inspector Modal */}
      <DocumentModal docId={activeDocId} onClose={() => setActiveDocId(null)} />

      {/* Provenance & Reproducibility Footer */}
      <footer className="border-t border-border bg-[#070709]/90 backdrop-blur-sm py-4 text-xs font-mono text-ink-muted relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-ink-primary">Hybrid RAG Research Console</span>
            <span>•</span>
            <span>MITRE ATT&amp;CK v14.1 &amp; NVD CVE</span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-ink-faint">
            <span>sha256:{overview?.corpus?.sha256 ? overview.corpus.sha256.slice(0, 10) : 'cdcc725809'}...</span>
            <span>•</span>
            <span>Qdrant Local Engine</span>
            <span>•</span>
            <span>Extractive Zero-Hallucination Grounding</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
