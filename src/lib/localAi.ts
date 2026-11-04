import { accountClient } from './accounts';
const AI_TOKEN_STORAGE_KEY = 'hansearch_ai_access_token';

async function memberHeaders(): Promise<Record<string, string>> {
  const { data: { session }, error } = await accountClient().auth.getSession();
  if (error || !session) throw new Error('다시 로그인해 주세요.');
  return { Authorization: `Bearer ${session.access_token}` };
}

export function clearStoredAiToken(): void {
  try {
    localStorage.removeItem(AI_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors; AI requests no longer use browser-stored credentials.
  }
}

function getRelayUrl(): string {
  const host = window.location.hostname;
  if (host === 'hansearch-web.karis830519.workers.dev' || host.endsWith('-hansearch-web.karis830519.workers.dev')) return window.location.origin;
  return 'https://hansearch-web.karis830519.workers.dev';
}

export interface AISearchResult {
  query: string;
  summary: string;
  results: Array<{ id: number; score: number }>;
  synced_count: number;
  saved_answer?: boolean;
  protocol_version?: number;
  coverage?: 'sufficient' | 'partial' | 'none' | 'unknown';
  web_available?: boolean;
  web?: WebAnswer;
}

export interface WebAnswer {
  status: 'complete' | 'error' | 'not_configured' | 'empty';
  summary: string;
  message?: string;
  sources: Array<{ number: number; title: string; url: string; body_checked?: boolean; evidence_quote?: string }>;
}

export type AISearchStatus = 'pending' | 'processing' | 'retrieving' | 'analyzing' | 'web_search' | 'web_analysis';

async function readResponse(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI 서버 오류 (${response.status})`);
  return data;
}

export async function runAISearch(
  query: string,
  onStatus?: (status: AISearchStatus) => void,
  options: { mode?: 'auto' | 'web'; signal?: AbortSignal; parentId?: string; onCreated?: (id: string) => void; onProgress?: (result: AISearchResult) => void } = {},
): Promise<AISearchResult> {
  const relayUrl = getRelayUrl();
  const createResponse = await fetch(`${relayUrl}/api/ai/jobs`, {
    method: 'POST',
    headers: { ...await memberHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, mode: options.mode || 'auto', parent_id: options.parentId }),
    signal: options.signal,
  });
  const job = await readResponse(createResponse);
  options.onCreated?.(job.id);
  let lastStatus: AISearchStatus = 'pending';
  onStatus?.(lastStatus);
  const deadline = Date.now() + 8 * 60 * 1000;

  while (Date.now() < deadline) {
    options.signal?.throwIfAborted();
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    const response = await fetch(`${relayUrl}/api/ai/jobs/${encodeURIComponent(job.id)}`, { headers: await memberHeaders(), signal: options.signal });
    const status = await readResponse(response);
    const stage = status.status === 'processing' ? status.stage || 'processing' : status.status;
    if ((status.status === 'pending' || status.status === 'processing') && stage !== lastStatus) {
      lastStatus = stage;
      onStatus?.(lastStatus);
    }
    if (status.status === 'processing' && status.result) options.onProgress?.(status.result as AISearchResult);
    if (status.status === 'complete' && status.result) return status.result as AISearchResult;
    if (status.status === 'error') throw new Error(status.error || 'AI 검색 처리에 실패했습니다.');
  }

  throw new Error('AI 검색 시간이 초과됐습니다. 한주AI 연결 상태를 확인해 주세요.');
}
