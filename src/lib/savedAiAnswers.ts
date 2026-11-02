import type { InfoItem, SupabaseConfig } from '../types';
import { getSupabaseClient, insertItem, updateItem } from './supabase';
import { AI_ANSWER_CATEGORY, findSavedAiAnswer } from '../utils/aiAnswers';

export async function fetchSavedAiAnswer(query: string, config: SupabaseConfig): Promise<InfoItem | undefined> {
  const client = getSupabaseClient(config);
  if (!client) throw new Error('저장된 답변을 확인할 수 없습니다. 데이터베이스 연결을 확인해 주세요.');
  // Read fresh records so corrections from another browser are reused immediately.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(config.tableName || 'info')
      .select('*').eq('키워드', AI_ANSWER_CATEGORY)
      .order('id', { ascending: false }).range(offset, offset + 999);
    if (error) throw error;
    const records = (data || []) as InfoItem[];
    const found = findSavedAiAnswer(records, query);
    if (found || records.length < 1000) return found;
  }
}

export async function saveAiAnswer(question: string, answer: string, config: SupabaseConfig): Promise<InfoItem> {
  const title = question.trim();
  const content = answer.trim();
  if (!title || !content) throw new Error('검색어와 수정 답변을 모두 입력해 주세요.');
  const existing = await fetchSavedAiAnswer(title, config);
  const payload = { 키워드: AI_ANSWER_CATEGORY, 키워드2: title, 내용: content };
  return existing?.id
    ? updateItem(existing.id, payload, config)
    : insertItem(payload, config);
}

