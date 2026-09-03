export interface InfoItem {
  id?: number;
  created_at?: string;
  키워드: string;   // Category (대분류)
  키워드2: string;  // Title (제목 / 키워드2)
  내용: string;     // Content (본문 / 상세 내용)
  이미지들?: string | null; // Image URLs (콤마 또는 공백 또는 단일 URL)
  is_favorite?: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  storageBucket: string;
}

export type SortOption = 'latest' | 'oldest' | 'title_asc' | 'title_desc';
