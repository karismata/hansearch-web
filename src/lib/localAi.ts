const AI_TOKEN_STORAGE_KEY = 'hansearch_ai_access_token';

function getRelayUrl(): string {
  const host = window.location.hostname;
  const pagesSuffix = '.hansearch-web.pages.dev';
  if (host === 'hansearch-web.karis830519.workers.dev') return window.location.origin;
  if (host.endsWith(pagesSuffix)) {
    const previewName = host.slice(0, -pagesSuffix.length);
    if (previewName) return `https://${previewName}-hansearch-web.karis830519.workers.dev`;
  }
  return 'https://hansearch-web.karis830519.workers.dev';
}

export interface AISearchResult {
  query: string;
  summary: string;
  results: Array<{ id: number; score: number }>;
  synced_count: number;
}

export function getStoredAiToken(): string {
  try {
    return localStorage.getItem(AI_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredAiToken(token: string): void {
  try {
    if (token.trim()) localStorage.setItem(AI_TOKEN_STORAGE_KEY, token.trim());
    else localStorage.removeItem(AI_TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error('AI 연결 키 저장 실패:', error);
  }
}

async function readResponse(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `AI 서버 오류 (${response.status})`);
  return data;
}

export async function runAISearch(query: string, token: string): Promise<AISearchResult> {
  const authorization = { Authorization: `Bearer ${token.trim()}` };
  const relayUrl = getRelayUrl();
  const createResponse = await fetch(`${relayUrl}/api/ai/jobs`, {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const job = await readResponse(createResponse);
  const deadline = Date.now() + 4 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    const response = await fetch(`${relayUrl}/api/ai/jobs/${encodeURIComponent(job.id)}`, {
      headers: authorization,
    });
    const status = await readResponse(response);
    if (status.status === 'complete' && status.result) return status.result as AISearchResult;
    if (status.status === 'error') throw new Error(status.error || 'AI 검색 처리에 실패했습니다.');
  }

  throw new Error('AI 검색 시간이 초과됐습니다. 맥미니가 켜져 있는지 확인해 주세요.');
}
