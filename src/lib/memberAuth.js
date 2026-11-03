const DEFAULT_URL = 'https://trtpgahsnuddenmxuazq.supabase.co';
const DEFAULT_KEY = 'sb_publishable_N_NBrRMNfUDwfCodR-nZ6g_KCFEZiw1';

export async function approvedMember(request, env, fetcher = fetch) {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!/^Bearer\s+/i.test(authorization)) return null;
  let subject;
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    subject = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '='))).sub;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject)) return null;
  } catch { return null; }
  // Decoding is not authentication: PostgREST validates the JWT and RLS before returning the profile.
  const url = new URL('/rest/v1/member_profiles', env.SUPABASE_URL || DEFAULT_URL);
  url.searchParams.set('id', `eq.${subject}`);
  url.searchParams.set('select', 'id,status,role');
  const response = await fetcher(url, { headers: { Authorization: authorization, apikey: env.SUPABASE_ANON_KEY || DEFAULT_KEY }, cache: 'no-store' });
  if (!response.ok) return null;
  const profiles = await response.json();
  const member = Array.isArray(profiles) && profiles.length === 1 ? profiles[0] : null;
  return member?.id === subject && member.status === 'approved' && ['member','master'].includes(member.role) ? member : null;
}
