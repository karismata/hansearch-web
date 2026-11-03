import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { accountAction, accountClient, accountStatistics, approveMember, listMembers } from '../lib/accounts';
import type { AccountStatistics, MemberProfile } from '../lib/accounts';
import { useAccount } from './AccountGate';
import { formatDate } from '../utils/helpers';

export function AccountAdmin({ onClose }: { onClose: () => void }) {
  const { profile } = useAccount();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [stats, setStats] = useState<AccountStatistics[]>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sort, setSort] = useState<'data_created' | 'total_searches' | 'ai_searches'>('data_created');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetId, setResetId] = useState('');
  const [password, setPassword] = useState('');
  const [syncToken, setSyncToken] = useState('');
  const load = async () => {
    setBusy(true); setError('');
    try {
      const [people, counts] = await Promise.all([listMembers(), accountStatistics(start, end)]);
      setMembers(people); setStats(counts);
    } catch (err) { setError(err instanceof Error ? err.message : '관리 정보를 불러오지 못했습니다.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [onClose, busy]);
  if (profile.role !== 'master') return null;
  const action = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(message); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : '요청 처리에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  const remove = (member: MemberProfile) => {
    if (window.confirm(`${member.username} 계정을 삭제할까요? 로그인과 서비스 접근이 차단됩니다. 작성 자료·작성자 기록·통계는 유지됩니다.`)) {
      void action(() => accountAction({ action: 'delete', user_id: member.id }), '계정을 삭제했습니다.');
    }
  };
  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    const value = password;
    setPassword('');
    await action(() => accountAction({ action: 'reset_password', user_id: resetId, password: value }), '비밀번호를 변경했습니다.');
    setResetId('');
  };
  const setSync = async (event: FormEvent) => {
    event.preventDefault(); const value = syncToken; setSyncToken('');
    await action(async () => {
      const { error: rpcError } = await accountClient().rpc('hansearch_set_ai_sync_token', { p_token: value });
      if (rpcError) throw rpcError;
    }, '동기화 연결키를 등록했습니다.');
  };
  const ranked = [...stats].sort((a,b) => Number(b[sort])-Number(a[sort]) || a.username.localeCompare(b.username));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
    <section role="dialog" aria-modal="true" aria-labelledby="account-admin-title" className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 p-4"><h2 id="account-admin-title" className="font-bold text-slate-800">계정 관리 · 사용 통계</h2><button type="button" onClick={onClose} disabled={busy} aria-label="관리 화면 닫기" className="p-2"><X size={20} /></button></div>
      <div className="space-y-6 overflow-y-auto p-4 sm:p-6">
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <section>
          <h3 className="font-bold text-slate-800">회원 관리</h3>
          <p className="mt-1 text-xs text-slate-500">승인 대기 {members.filter(m => m.status === 'pending').length}명 · 승인된 회원만 검색과 자료 관리를 이용할 수 있습니다.</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-2">아이디</th><th className="p-2">상태</th><th className="p-2">가입일</th><th className="p-2">관리</th></tr></thead><tbody>
            {members.map(member => <tr key={member.id} className="border-b border-slate-100"><td className="p-2 font-medium">{member.username}{member.role === 'master' ? ' · 마스터' : ''}</td><td className="p-2">{member.status === 'pending' ? '승인 대기' : member.status === 'approved' ? '승인됨' : '삭제 처리 중'}</td><td className="whitespace-nowrap p-2 text-xs">{formatDate(member.created_at)}</td><td className="p-2">{member.role !== 'master' && <div className="flex flex-wrap gap-2">
              {member.status === 'pending' && <button disabled={busy} onClick={() => void action(() => approveMember(member.id), '가입을 승인했습니다.')} className="text-blue-700 underline">승인</button>}
              {member.status !== 'deleted' && <button disabled={busy} onClick={() => { setResetId(member.id); setPassword(''); }} className="text-slate-600 underline">비밀번호 변경</button>}
              <button disabled={busy} onClick={() => remove(member)} className="text-rose-700 underline">{member.status === 'deleted' ? '삭제 마무리' : '삭제'}</button>
            </div>}</td></tr>)}
          </tbody></table></div>
          {resetId && <form onSubmit={resetPassword} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3"><label className="text-sm">새 비밀번호<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="ml-2 rounded border border-slate-300 p-2" /></label><button disabled={busy} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">변경</button><button type="button" disabled={busy} onClick={() => { setResetId(''); setPassword(''); }} className="text-sm">취소</button></form>}
        </section>
        <section>
          <h3 className="font-bold text-slate-800">계정별 통계</h3>
          <form onSubmit={e => { e.preventDefault(); void load(); }} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-600">시작일<input type="date" value={start} onChange={e => setStart(e.target.value)} className="mt-1 block rounded border border-slate-300 p-2" /></label>
            <label className="text-xs text-slate-600">종료일<input type="date" value={end} onChange={e => setEnd(e.target.value)} className="mt-1 block rounded border border-slate-300 p-2" /></label>
            <button disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">{busy ? '확인 중...' : '조회·새로고침'}</button>
            <select aria-label="통계 순위 기준" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="rounded border border-slate-300 p-2 text-sm"><option value="data_created">자료 생성 많은 순</option><option value="total_searches">전체 검색 많은 순</option><option value="ai_searches">AI 검색 많은 순</option></select>
          </form>
          <p className="mt-2 text-xs text-slate-500">날짜를 비우면 전체 기간입니다. 한국 시간 기준이며 기능 적용 이후부터 집계합니다. 자료 생성은 삭제된 자료도 포함한 누적 생성 횟수입니다. 검색은 일반 검색과 AI 검색 실행 횟수이며 입력·대기 상태 조회는 세지 않습니다.</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-2 text-left">아이디</th><th className="p-2">자료 생성</th><th className="p-2">일반 검색</th><th className="p-2">AI 검색</th><th className="p-2">전체 검색</th></tr></thead><tbody>
            {ranked.map(row => <tr key={row.user_id} className="border-b border-slate-100"><td className="p-2 text-left font-medium">{row.username}{row.status === 'deleted' ? ' (삭제된 계정)' : ''}</td><td className="p-2">{Number(row.data_created).toLocaleString()}</td><td className="p-2">{Number(row.searches).toLocaleString()}</td><td className="p-2">{Number(row.ai_searches).toLocaleString()}</td><td className="p-2 font-semibold">{Number(row.total_searches).toLocaleString()}</td></tr>)}
          </tbody></table></div>
        </section>
        <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">한주AI 동기화 연결 설정</summary><form onSubmit={setSync} className="mt-3 space-y-2"><p className="text-xs text-slate-500">최초 설정 시 맥미니 .env의 AI_ACCESS_TOKEN과 같은 값을 등록하세요. 연결키는 해시로 저장되며 다시 표시되지 않습니다.</p><input aria-label="동기화 연결키" type="password" autoComplete="off" minLength={32} maxLength={256} required value={syncToken} onChange={e => setSyncToken(e.target.value)} disabled={busy} className="w-full rounded border border-slate-300 p-2 text-sm" /><button disabled={busy} className="rounded bg-slate-700 px-3 py-2 text-sm text-white">연결키 등록</button></form></details>
      </div>
    </section>
  </div>;
}
