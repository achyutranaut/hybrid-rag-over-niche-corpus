export type StageId =
  | 'corpus'
  | 'query'
  | 'retrieve'
  | 'rerank'
  | 'evaluate'
  | 'methodology'
  | 'architecture';

export interface StageItem {
  id: StageId;
  step: string;
  name: string;
  subhead: string;
}

export const STAGES: StageItem[] = [
  { id: 'corpus', step: '01', name: 'Corpus', subhead: 'Corpus & Tiers' },
  { id: 'query', step: '02', name: 'Query Understanding', subhead: 'Token Parsing' },
  { id: 'retrieve', step: '03', name: 'Playground', subhead: 'Retrieval & Fusion' },
  { id: 'rerank', step: '04', name: 'Retrieval Inspector', subhead: 'Candidate Funnel' },
  { id: 'evaluate', step: '05', name: 'Evaluation', subhead: 'Held-Out Benchmark' },
  { id: 'architecture', step: '06', name: 'Architecture', subhead: 'System Design' },
  { id: 'methodology', step: '07', name: 'Methodology', subhead: 'Forensic Spec' },
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
    case 'methodology':
    default:
      return 'methodology';
  }
}
