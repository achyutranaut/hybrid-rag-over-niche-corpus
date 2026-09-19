import {
  OverviewResponse,
  QueryResponse,
  InspectResponse,
  CompareResponse,
  QueryUnderstandingResponse,
  SampleQuery,
  DocumentResponse,
  EvaluationsSummary,
  RetrievalStrategy,
} from '../types/api';

const API_BASE = '/api/v1';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) errorMsg = errJson.detail;
    } catch {
      // ignore
    }
    const err = new Error(errorMsg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchHealth(): Promise<{ status: string; collection_points: number }> {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse(res);
}

export async function fetchOverview(): Promise<OverviewResponse> {
  const res = await fetch(`${API_BASE}/overview`);
  return handleResponse(res);
}

export async function submitQuery(params: {
  query: string;
  strategy?: RetrievalStrategy;
  document_type?: string | null;
  source?: string | null;
  router?: boolean;
  enable_acronym_expansion?: boolean;
  auto_filter_identifiers?: boolean;
  floor_mode?: string | null;
  floor_threshold?: number | null;
  top_k_rerank?: number | null;
}): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}

export async function inspectQuery(params: {
  query: string;
  top_k?: number;
  top_k_rerank?: number;
  document_type?: string | null;
  source?: string | null;
  enable_acronym_expansion?: boolean;
}): Promise<InspectResponse> {
  const res = await fetch(`${API_BASE}/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}

export async function compareStrategies(params: {
  query: string;
  strategies?: RetrievalStrategy[];
  document_type?: string | null;
  source?: string | null;
  enable_acronym_expansion?: boolean;
}): Promise<CompareResponse> {
  const res = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}

export async function analyzeQueryUnderstanding(params: {
  query: string;
  enable_acronym_expansion?: boolean;
  router?: boolean;
}): Promise<QueryUnderstandingResponse> {
  const res = await fetch(`${API_BASE}/query-understanding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}

export async function fetchSampleQueries(): Promise<SampleQuery[]> {
  const res = await fetch(`${API_BASE}/sample-queries`);
  return handleResponse(res);
}

export async function fetchDocument(docId: string): Promise<DocumentResponse> {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(docId)}`);
  return handleResponse(res);
}

export async function fetchEvaluationsSummary(): Promise<EvaluationsSummary> {
  const res = await fetch(`${API_BASE}/evaluations/summary`);
  return handleResponse(res);
}

export async function fetchEvaluationDetail(runId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/evaluations/${runId}`);
  return handleResponse(res);
}
