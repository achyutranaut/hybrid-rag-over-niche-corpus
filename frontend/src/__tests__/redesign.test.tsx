import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/ui/MetricCard';
import { Tabs } from '../components/ui/Tabs';
import { RankShiftInspector } from '../components/RankShiftInspector';
import { Pipeline3DCanvas } from '../components/Pipeline3DCanvas';
import { QueryUnderstandingView } from '../components/QueryUnderstandingView';

describe('Redesigned UI Primitives & Interaction Tests', () => {
  it('renders Badge with attack and cve semantic variants', () => {
    const { rerender } = render(<Badge variant="attack">T1059.001</Badge>);
    expect(screen.getByText('T1059.001')).toBeInTheDocument();

    rerender(<Badge variant="cve">CVE-2021-44228</Badge>);
    expect(screen.getByText('CVE-2021-44228')).toBeInTheDocument();

    rerender(<Badge variant="valid">Grounded</Badge>);
    expect(screen.getByText('Grounded')).toBeInTheDocument();
  });

  it('renders Button with variants, handles click, and shows loading state', () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <Button variant="primary" onClick={handleClick}>
        Execute Search
      </Button>
    );

    const btn = screen.getByRole('button', { name: /execute search/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button variant="secondary" loading={true}>
        Loading
      </Button>
    );
    expect(btn).toBeDisabled();
  });

  it('renders MetricCard with tabular figure and subtext', () => {
    render(
      <MetricCard
        label="Corpus Chunks"
        value={1162}
        subtext="Dual-vector points"
        highlight="attack"
      />
    );
    expect(screen.getByText('Corpus Chunks')).toBeInTheDocument();
    expect(screen.getByText('1162')).toBeInTheDocument();
    expect(screen.getByText('Dual-vector points')).toBeInTheDocument();
  });

  it('renders Tabs and triggers onChange callback', () => {
    const handleChange = vi.fn();
    render(
      <Tabs
        tabs={[
          { id: 'b1', label: 'B1: Embedders' },
          { id: 'b2', label: 'B2: Reranker' },
        ]}
        activeTab="b1"
        onChange={handleChange}
      />
    );

    const b2Tab = screen.getByRole('button', { name: /B2: Reranker/i });
    fireEvent.click(b2Tab);
    expect(handleChange).toHaveBeenCalledWith('b2');
  });

  it('filters candidates in RankShiftInspector using search input', () => {
    const mockTracker = [
      {
        chunk_id: 'cve:CVE-2021-44228#c0',
        parent_doc_id: 'cve:CVE-2021-44228',
        title: 'Log4j RCE',
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
        title: 'PowerShell',
        source: 'mitre_attack',
        document_type: 'technique',
        dense_rank: 2,
        sparse_rank: 3,
        hybrid_rank: 2,
        reranked_rank: 2,
      },
    ];

    const mockCandidate = {
      chunk_id: 'cve:CVE-2021-44228#c0',
      parent_doc_id: 'cve:CVE-2021-44228',
      source: 'cve_nvd',
      document_type: 'vulnerability',
      title: 'Log4j RCE',
      section: 'description',
      text: 'Remote code execution in Log4j',
      score: 0.95,
      rank: 1,
      retrieval_method: 'dense',
    };

    render(
      <RankShiftInspector
        rankTracker={mockTracker}
        denseCandidates={[mockCandidate]}
        sparseCandidates={[]}
        hybridCandidates={[]}
        rerankedCandidates={[]}
        onOpenDoc={() => {}}
      />
    );

    const filterInput = screen.getByPlaceholderText(/filter candidate id/i);
    expect(filterInput).toBeInTheDocument();

    fireEvent.change(filterInput, { target: { value: 'CVE-2021' } });
    expect(filterInput).toHaveValue('CVE-2021');
    expect(screen.getByText(/cve:CVE-2021-44228/i)).toBeInTheDocument();
  });

  it('renders Pipeline3DCanvas and switches to 2D flat mode', () => {
    const handleSelect = vi.fn();
    render(
      <Pipeline3DCanvas activeStageId="rrf" onSelectStage={handleSelect} />
    );

    const flatBtn = screen.getByRole('button', { name: /2D Flat/i });
    expect(flatBtn).toBeInTheDocument();
    fireEvent.click(flatBtn);

    const rrfElements = screen.getAllByText('RRF Fusion');
    expect(rrfElements.length).toBeGreaterThan(0);

    const rrfBtns = screen.getAllByRole('button', { name: /RRF Fusion/i });
    fireEvent.click(rrfBtns[0]);
    expect(handleSelect).toHaveBeenCalledWith('rrf');
  });

  it('renders QueryUnderstandingView with in-situ entity token parsing', () => {
    render(<QueryUnderstandingView />);
    expect(screen.getByText(/Live Query Understanding/i)).toBeInTheDocument();
    expect(screen.getByText(/Live In-Situ Token Extraction/i)).toBeInTheDocument();
  });
});
