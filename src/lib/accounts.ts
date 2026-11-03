import { getDefaultConfig, getSupabaseClient } from './supabase';

export interface MemberProfile {
  id: string;
  username: string;
  role: 'master' | 'member';
  status: 'pending' | 'approved' | 'deleted';
  created_at: string;
}
export interface AccountStatistics {
  user_id: string; username: string; status: string; role: string;
  data_created: number; searches: number; ai_searches: number; total_searches: number;
}
export function accountClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('계정 서비스 연결을 확인해 주세요.');
  return client;
}
export function normalizeUsername(value: string) { return value.normalize('NFKC').trim().toLowerCase(); }
export function accountEmail(value: string) {
  const id = normalizeUsername(value);
  if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(id)) throw new Error('아이디는 영문·숫자·._- 조합 3~32자로 입력해 주세요.');
  return `${id}@login.hansearch.invalid`;
}
export async function accountAction(body: Record<string, unknown>) {
  const config = getDefaultConfig();
  const { data: { session } } = await accountClient().auth.getSession();
  const response = await fetch(`${config.url}/functions/v1/accounts`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '계정 요청 처리에 실패했습니다.');
  return data;
}
export async function readProfile(id: string): Promise<MemberProfile | null> {
  const { data, error } = await accountClient().from('member_profiles').select('id,username,role,status,created_at').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export async function listMembers(): Promise<MemberProfile[]> {
  const all: MemberProfile[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await accountClient().from('member_profiles').select('id,username,role,status,created_at')
      .order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
    if (error) throw error;
    all.push(...(data || []));
    if ((data || []).length < 1000) return all;
  }
}
export async function approveMember(id: string) {
  const { error } = await accountClient().rpc('hansearch_approve_account', { p_id: id });
  if (error) throw error;
}
export async function recordSearch(kind: 'search' | 'ai_search', eventId = crypto.randomUUID()) {
  const { error } = await accountClient().rpc('hansearch_record_search', { p_kind: kind, p_event_id: eventId });
  if (error) throw error;
}
export function koreaDateRange(start: string, end: string) {
  const from = start ? new Date(`${start}T00:00:00+09:00`) : null;
  const until = end ? new Date(new Date(`${end}T00:00:00+09:00`).getTime() + 86400000) : null;
  if ((from && Number.isNaN(from.getTime())) || (until && Number.isNaN(until.getTime())) || (from && until && from >= until)) throw new Error('날짜 범위를 확인해 주세요.');
  return { p_start: from?.toISOString() || null, p_end: until?.toISOString() || null };
}
export async function accountStatistics(start: string, end: string): Promise<AccountStatistics[]> {
  const { data, error } = await accountClient().rpc('hansearch_account_statistics', koreaDateRange(start, end));
  if (error) throw error;
  return data || [];
}
