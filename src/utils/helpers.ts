export const DEFAULT_TAGS = [
  '#as',
  '#단말기',
  '#명의변경',
  '#cctv',
  '#네이버커넥트',
  '#정보변경',
  '#특정',
  '#나이스',
  '#키오스크',
  '#포스',
  '#테이블오더'
];

const FAVORITES_KEY = 'hansearch_favorites';
const TAGS_KEY = 'hansearch_custom_tags';


export function getStoredFavorites(): number[] {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveStoredFavorites(favs: number[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch (e) {
    console.error('Failed to save favorites', e);
  }
}

export function getStoredTags(): string[] {
  try {
    const saved = localStorage.getItem(TAGS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
}

export function saveStoredTags(tags: string[]) {
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
  } catch (e) {
    console.error('Failed to save tags', e);
  }
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d} ${hh}:${mm}`;
  } catch {
    return dateString;
  }
}

/**
 * Parses image URL(s) from text. Can handle comma-separated, space-separated,
 * newlines, or JSON arrays.
 */
export function parseImageUrls(raw?: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === 'EMPTY' || trimmed.toUpperCase() === 'NULL') {
    return [];
  }

  // Try JSON parse first
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
      }
    } catch {
      // ignore
    }
  }

  // Split by newlines, commas, or semicolons
  const parts = trimmed.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  return parts;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * Normalizes content text by converting various newline representations
 * (\n, \\n, <br>, NL, nl, \u2424) into real line breaks.
 */
export function normalizeContentText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/[\u2424\u0085\u2028\u2029]/g, '\n')
    // Convert 'NL' / 'nl' delimiter tokens to newlines
    .replace(/(?:\b|\s)NL(?:\b|\s)/g, '\n')
    .replace(/(?:\b|\s)nl(?:\b|\s)/g, '\n')
    .replace(/([^\s])\s*NL\s*([^\s])/gi, '$1\n$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses multiple categories separated by semicolons (;) or commas (,).
 * e.g. "KICC(이지);OKPOS;공통;나이스;업무;에러" -> ["KICC(이지)", "OKPOS", "공통", "나이스", "업무", "에러"]
 */
export function parseCategories(raw?: string | null): string[] {
  if (!raw) return ['공통'];
  const split = raw.split(/[;,]+/).map((s) => s.trim()).filter(Boolean);
  return split.length > 0 ? split : ['공통'];
}

