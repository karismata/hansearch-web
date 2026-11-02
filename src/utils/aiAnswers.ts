import type { InfoItem } from '../types';

export const AI_ANSWER_CATEGORY = 'AI 검증답변';

export function normalizeQuestion(question: string): string {
  return question.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function findSavedAiAnswer(items: InfoItem[], query: string): InfoItem | undefined {
  const question = normalizeQuestion(query);
  if (!question) return undefined;
  return items
    .filter((item) => item.키워드 === AI_ANSWER_CATEGORY && item.내용?.trim() &&
      normalizeQuestion(item.키워드2 || '') === question)
    .sort((a, b) => (b.id || 0) - (a.id || 0))[0];
}

