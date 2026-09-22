export type StageId =
  | 'corpus'
  | 'query'
  | 'retrieve'
  | 'rerank'
  | 'evaluate'
  | 'architecture'
  | 'methodology';

export interface StageItem {
  id: StageId;
  step: string;
  name: string;
  subhead: string;
  category: 'EXPLORE' | 'INSPECT' | 'EVALUATE' | 'SYSTEM';
}

export const STAGES: StageItem[] = [
  { id: 'corpus', step: '01', name: 'Corpus', subhead: 'Corpus & Tiers', category: 'EXPLORE' },
  { id: 'query', step: '02', name: 'Query Understanding', subhead: 'Live Token Parsing', category: 'EXPLORE' },
  { id: 'retrieve', step: '03', name: 'Playground', subhead: 'Retrieval & Fusion', category: 'EXPLORE' },
  { id: 'rerank', step: '04', name: 'Retrieval Inspector', subhead: 'Candidate Funnel', category: 'INSPECT' },
  { id: 'evaluate', step: '05', name: 'Evaluation', subhead: 'Held-Out Benchmark', category: 'EVALUATE' },
  { id: 'architecture', step: '06', name: 'Architecture', subhead: 'System Design', category: 'SYSTEM' },
  { id: 'methodology', step: '07', name: 'Methodology', subhead: 'Forensic Spec', category: 'SYSTEM' },
];

export type TabId =
  | 'overview'
  | 'playground'
  | 'inspector'
  | 'query_understanding'
  | 'evaluation'
  | 'architecture'
  | 'methodology'
  | 'corpus'
  | 'query'
  | 'retrieve'
  | 'rerank'
  | 'evaluate';

export function tabToStage(tab: TabId): StageId {
  switch (tab) {
    case 'overview':
    case 'corpus':
      return 'corpus';
    case 'query_understanding':
    case 'query':
      return 'query';
    case 'playground':
    case 'retrieve':
      return 'retrieve';
    case 'inspector':
    case 'rerank':
      return 'rerank';
    case 'evaluation':
    case 'evaluate':
      return 'evaluate';
    case 'architecture':
      return 'architecture';
    case 'methodology':
    default:
      return 'methodology';
  }
}
