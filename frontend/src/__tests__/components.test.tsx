import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Navbar } from '../components/Navbar';
import { OverviewDashboard } from '../components/OverviewDashboard';
import { HeroMetric } from '../components/HeroMetric';
import { RankShiftInspector } from '../components/RankShiftInspector';
import { CodeBlock } from '../components/CodeBlock';
import { PipelineStepper } from '../components/PipelineStepper';
import { DocumentModal } from '../components/DocumentModal';
import { OverviewResponse } from '../types/api';

const mockOverview: OverviewResponse = {
  title: 'Hybrid RAG Over a Niche Cybersecurity Corpus',
  research_question: 'For which classes of cybersecurity query does dense, sparse, or hybrid retrieval perform best?',
  corpus: {
    total_chunks: 1162,
    total_documents: 717,
    mitre_attack_techniques: 697,
    cve_records: 20,
    sha256: 'cdcc7258098ffa61',
    collection_name: 'cyber_corpus_v1',
    storage_mode: 'embedded_qdrant',
  },
  tiers: {
    tier_a: {
      name: 'Local Stand-in Stack',
      dense_embedder: 'TF-IDF + SVD',
      sparse_engine: 'BM25',
      fusion: 'RRF',
      reranker: 'Lexical',
      generator: 'Extractive',
      active: true,
    },
    tier_b: {
      name: 'Target Neural Stack',
      dense_embedder: 'BGE-small',
      sparse_engine: 'BM25',
      fusion: 'RRF',
      reranker: 'Cross-Encoder',
      generator: 'Claude',
      active: false,
    },
  },
  status: {
    backend: 'online',
    collection_ready: true,
    experiments_completed: true,
    latest_evaluation: 'Held-Out TEST Split',
  },
};

describe('Frontend Component Tests', () => {
  it('renders Navbar with title and navigation tabs', () => {
    render(
      <Navbar
        activeTab="overview"
        onTabChange={() => {}}
        overview={mockOverview}
        backendOnline={true}
      />
    );
    expect(screen.getByText(/Hybrid RAG/i)).toBeInTheDocument();
    expect(screen.getByText('Playground')).toBeInTheDocument();
    expect(screen.getByText('Retrieval Inspector')).toBeInTheDocument();
    expect(screen.getByText('Query Understanding')).toBeInTheDocument();
    expect(screen.getByText('Evaluation')).toBeInTheDocument();
    expect(screen.getByText('Architecture')).toBeInTheDocument();
    expect(screen.getByText('Methodology')).toBeInTheDocument();
  });

  it('renders OverviewDashboard with corpus statistics', () => {
    render(
      <OverviewDashboard
        overview={mockOverview}
        onNavigate={() => {}}
      />
    );
    expect(screen.getByText(/1162/)).toBeInTheDocument();
    expect(screen.getByText(/697/)).toBeInTheDocument();
    expect(screen.getByText(/20/)).toBeInTheDocument();
    expect(screen.getByText(/TIER A/i)).toBeInTheDocument();
    expect(screen.getByText(/TIER B/i)).toBeInTheDocument();
  });

  it('renders HeroMetric with scientific metric hierarchy and sha256', () => {
    render(
      <HeroMetric
        split="test"
        mrr={0.7381}
        ndcg={0.8502}
        recall={0.6786}
        corpusSha="cdcc7258098ffa61"
      />
    );
    expect(screen.getByText('0.738')).toBeInTheDocument();
    expect(screen.getByText('0.850')).toBeInTheDocument();
    expect(screen.getByText('0.679')).toBeInTheDocument();
    expect(screen.getByText(/TEST \(n=16\)/i)).toBeInTheDocument();
    expect(screen.getByText('cdcc725809')).toBeInTheDocument();
  });

  it('renders RankShiftInspector with SVG lanes and candidate trajectory paths', () => {
    const mockTracker = [
      {
        chunk_id: 'cve:CVE-2021-44228#c0',
        parent_doc_id: 'cve:CVE-2021-44228',
        title: 'Apache Log4j RCE',
        source: 'cve_nvd',
        document_type: 'vulnerability',
        dense_rank: 1,
        sparse_rank: 1,
        hybrid_rank: 1,
        reranked_rank: 1,
      },
      {
        chunk_id: 'attack:T1059.001#c0',
        parent_doc_id: 'attack:T1059.001',
        title: 'PowerShell Execution',
        source: 'mitre_attack',
        document_type: 'technique',
        dense_rank: 2,
        sparse_rank: 3,
        hybrid_rank: 2,
        reranked_rank: 2,
      },
    ];

    render(
      <RankShiftInspector
        rankTracker={mockTracker}
        denseCandidates={[]}
        sparseCandidates={[]}
        hybridCandidates={[]}
        rerankedCandidates={[]}
        onOpenDoc={() => {}}
      />
    );

    expect(screen.getByText('Candidate Trajectory & Rank-Shift Funnel')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /candidate rank shift diagram/i })).toBeInTheDocument();
  });

  it('renders CodeBlock with syntax styling and copy action', () => {
    render(
      <CodeBlock
        code="models.FusionQuery(fusion=models.Fusion.RRF)"
        language="python"
        filename="src/retrieval/qdrant_store.py"
      />
    );
    expect(screen.getByText('src/retrieval/qdrant_store.py')).toBeInTheDocument();
    expect(screen.getByText(/models\.FusionQuery/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument();
  });

  it('renders PipelineStepper with proper data-stage attributes', () => {
    render(
      <PipelineStepper
        activeStage="query"
        onStageChange={() => {}}
      />
    );
    const queryStep = screen.getByRole('button', { name: /query understanding/i });
    expect(queryStep).toHaveAttribute('data-stage', 'active');
  });

  it('renders DocumentModal when docId is provided and handles null gracefully', () => {
    const { container, rerender } = render(
      <DocumentModal docId={null} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();

    rerender(<DocumentModal docId="cve:CVE-2021-44228" onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('cve:CVE-2021-44228')).toBeInTheDocument();
    expect(screen.getByText(/Fetching chunks from Qdrant/i)).toBeInTheDocument();
  });
});
