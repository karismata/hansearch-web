import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { accountAction, accountClient, accountEmail, normalizeUsername, readProfile } from '../lib/accounts';
import type { MemberProfile } from '../lib/accounts';

interface AccountContextValue { profile: MemberProfile; signOut: () => Promise<void> }
const AccountContext = createContext<AccountContextValue | null>(null);
export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error('승인된 로그인이 필요합니다.');
  return context;
}

export function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [signup, setSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const checkedUser = useRef<string | null>(null);
  const userId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;
  useEffect(() => {
    let active = true;
    const client = accountClient();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setInitializing(false); }
    });
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError('로그인 상태를 확인할 수 없습니다. 다시 시도해 주세요.');
      setSession(data.session); setInitializing(false);
    }).catch(() => {
      if (active) { setError('로그인 상태를 확인할 수 없습니다. 다시 시도해 주세요.'); setInitializing(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    if (!userId) { checkedUser.current = null; setProfile(null); setLoading(false); return; }
    // Auth may emit SIGNED_IN again on focus or from another client/tab.
    // Keep this user's verified view mounted during background checks.
    if (checkedUser.current !== userId) { setLoading(true); setProfile(null); }
    const refresh = async () => {
      const version = ++requestVersion;
      try {
        const found = await readProfile(userId);
        if (active && version === requestVersion) {
          checkedUser.current = userId; setProfile(found);
          setError(found ? '' : '이용할 수 없는 계정입니다. 마스터에게 문의해 주세요.');
        }
      } catch { if (active && version === requestVersion) { checkedUser.current = null; setProfile(null); setError('계정 승인 상태를 확인할 수 없습니다. 다시 확인해 주세요.'); } }
      finally { if (active && version === requestVersion) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [userId, accessToken, retry]);
  const signOut = async () => {
    const { error: logoutError } = await accountClient().auth.signOut();
    if (logoutError) await accountClient().auth.signOut({ scope: 'local' });
    setSession(null); setProfile(null); setPassword(''); setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const email = accountEmail(username);
      if (signup) {
        if (password !== confirmation) throw new Error('비밀번호 확인이 일치하지 않습니다.');
        await accountAction({ action: 'register', username: normalizeUsername(username), password });
        setSignup(false); setNotice('가입 신청이 완료됐습니다. 마스터 승인 후 로그인할 수 있습니다.');
      } else {
        const { error: loginError } = await accountClient().auth.signInWithPassword({ email, password });
        if (loginError) throw new Error('아이디 또는 비밀번호를 확인해 주세요.');
      }
      setPassword(''); setConfirmation('');
    } catch (err) { setError(err instanceof Error ? err.message : '요청 처리에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  if (!initializing && !loading && profile?.status === 'approved' && profile.id === userId && session) {
    return <AccountContext.Provider value={{ profile, signOut }}>{children}</AccountContext.Provider>;
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
    <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-black text-slate-800">HanSearch</h1>
      {initializing || loading ? <p className="mt-4 text-sm text-slate-500">계정을 확인하고 있습니다...</p> : session ? <>
        <h2 className="mt-4 font-bold text-slate-800">{profile?.status === 'pending' ? '가입 승인 대기 중' : '계정 이용 확인 필요'}</h2>
        <p className="mt-2 text-sm text-slate-600">{profile?.status === 'pending' ? `${profile.username} 계정은 마스터 승인 후 이용할 수 있습니다.` : '삭제되었거나 승인되지 않은 계정입니다. 마스터에게 문의해 주세요.'}</p>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-4 flex gap-3"><button type="button" onClick={() => setRetry(v => v + 1)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">승인 상태 확인</button><button type="button" onClick={() => void signOut()} className="px-3 py-2 text-sm text-slate-600">로그아웃</button></div>
      </> : <form onSubmit={submit} className="mt-4 space-y-4">
        <h2 className="font-bold text-slate-800">{signup ? '가입 신청' : '로그인'}</h2>
        <label className="block text-sm text-slate-700">아이디<input required autoComplete="username" maxLength={32} value={username} onChange={e => setUsername(e.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
        <label className="block text-sm text-slate-700">비밀번호<input required type="password" minLength={signup ? 10 : undefined} maxLength={128} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label>
        {signup && <><label className="block text-sm text-slate-700">비밀번호 확인<input required type="password" autoComplete="new-password" maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5" /></label><p className="text-xs text-slate-500">아이디: 영문·숫자·._- 3~32자 / 비밀번호: 10자 이상. 가입 후 마스터 승인이 필요합니다.</p></>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-blue-600 p-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? '처리 중...' : signup ? '가입 신청' : '로그인'}</button>
        <button type="button" disabled={busy} onClick={() => { setSignup(v => !v); setPassword(''); setConfirmation(''); setError(''); setNotice(''); }} className="w-full text-sm text-blue-700">{signup ? '로그인으로 돌아가기' : '새 계정 가입 신청'}</button>
      </form>}
    </section>
  </main>;
}

