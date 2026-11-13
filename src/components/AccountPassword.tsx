import { useState } from 'react';
import type { FormEvent } from 'react';
import { accountClient } from '../lib/accounts';

export function AccountPassword({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage('');
    if (password !== confirmation) { setMessage('비밀번호 확인이 일치하지 않습니다.'); return; }
    setBusy(true);
    try {
      const { error } = await accountClient().auth.updateUser({ password });
      setMessage(error ? '비밀번호 변경에 실패했습니다. 다시 로그인한 뒤 시도해 주세요.' : '비밀번호를 변경했습니다.');
    } catch { setMessage('비밀번호 변경에 실패했습니다. 연결 상태를 확인해 주세요.'); }
    finally { setBusy(false); setPassword(''); setConfirmation(''); }
  };
  return <div data-native-back-busy={busy ? 'true' : undefined} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-label="비밀번호 변경" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6"><h2 className="font-bold">비밀번호 변경</h2>
    <label className="block text-sm">새 비밀번호<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
    <label className="block text-sm">비밀번호 확인<input type="password" required autoComplete="new-password" maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
    {message && <p role="status" className="text-sm text-blue-700">{message}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="px-3 py-2 text-sm">닫기</button><button disabled={busy} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">{busy ? '변경 중...' : '변경'}</button></div>
  </form></div>;
}
