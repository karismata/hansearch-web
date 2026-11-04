import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markNotificationsRead, type CommentNotification } from '../lib/notifications';
import { formatDate } from '../utils/helpers';

export function NotificationBell({ onOpenNotification }: { onOpenNotification: (notification: CommentNotification) => void }) {
  const [count, setCount] = useState(0);
  const [countError, setCountError] = useState(false);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CommentNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listRequest = useRef(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      fetchUnreadCount().then(value => { if (active) { setCount(value); setCountError(false); } })
        .catch(() => { if (active) setCountError(true); });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); listRequest.current++; };
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const load = async (more = false) => {
    const request = ++listRequest.current;
    setLoading(true); setError('');
    try {
      const [page, unread] = await Promise.all([fetchNotifications(more ? rows.length : 0), fetchUnreadCount()]);
      if (request !== listRequest.current) return;
      setRows(previous => more ? [...new Map([...previous, ...page.notifications].map(row => [row.id, row])).values()] : page.notifications);
      setTotal(page.total); setCount(unread); setCountError(false);
    } catch { if (request === listRequest.current) setError('알림을 불러오지 못했습니다. 새로고침을 눌러 주세요.'); }
    finally { if (request === listRequest.current) setLoading(false); }
  };
  const read = async (ids: string[]) => {
    setBusy(true); setError('');
    try {
      if (ids.length === 1) await markNotificationRead(ids[0]); else await markNotificationsRead(ids);
      setRows(items => items.map(item => ids.includes(item.id) ? { ...item, read_at: new Date().toISOString() } : item));
      setCount(await fetchUnreadCount());
    } catch { setError('읽음 처리를 완료하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  return (
    <div ref={root} className="relative shrink-0">
      <button ref={button} type="button" aria-label={countError ? '알림 연결 확인 필요' : `알림 ${count}개 안 읽음`} title="알림" aria-expanded={open}
        onClick={() => { setOpen(!open); if (!open) void load(); }} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
        <Bell size={19} aria-hidden="true" />
        {(count > 0 || countError) && <span className="absolute right-0 top-0 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{countError ? '!' : count > 99 ? '99+' : count}</span>}
      </button>
      {open && <section aria-label="내 댓글 알림" className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw_-_5rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs"><strong className="text-sm text-slate-800">알림</strong><div className="flex gap-3">
          <button type="button" disabled={busy || loading} onClick={() => void load()} className="text-blue-700">새로고침</button>
          <button type="button" disabled={busy || loading || !rows.some(row => !row.read_at)} onClick={() => void read(rows.filter(row => !row.read_at).map(row => row.id))} className="text-slate-500 disabled:opacity-50">표시된 알림 읽음</button>
        </div></div>
        <p className="mb-2 text-[11px] text-slate-500">내 자료의 댓글 · 내 댓글의 답글 · 약 1분마다 확인</p>
        {error && <p role="alert" className="mb-2 text-xs text-rose-700">{error}</p>}
        <div className="max-h-80 overflow-y-auto overscroll-contain space-y-1">
          {rows.map(row => <button key={row.id} type="button" disabled={loading} className={`block w-full rounded-lg p-2.5 text-left text-xs hover:ring-1 hover:ring-blue-300 ${row.read_at ? 'bg-slate-50 text-slate-600' : 'bg-blue-50 text-blue-900'}`} onClick={() => {
            setOpen(false); onOpenNotification(row); if (!row.read_at) void read([row.id]);
          }}>
            <p className="font-semibold">{row.actor_username}님이 {row.kind === 'reply' ? '내 댓글에 답글을' : '내 자료에 댓글을'} 남겼습니다.</p>
            <p className="mt-1 truncate">{row.info_title}</p><p className="mt-1 text-[11px] text-slate-400">{formatDate(row.created_at)}{row.read_at ? ' · 읽음' : ' · 새 알림'}</p>
            <span className="mt-1 block font-semibold text-blue-700">자료·댓글로 이동 →</span>
          </button>)}
        </div>
        {loading && <p role="status" className="py-2 text-xs text-slate-500">알림을 불러오는 중...</p>}
        {!loading && !error && rows.length === 0 && <p className="py-4 text-center text-xs text-slate-500">아직 알림이 없습니다.</p>}
        {rows.length < total && <button type="button" disabled={loading || busy} className="mt-2 w-full py-2 text-xs text-blue-700" onClick={() => void load(true)}>알림 더 보기</button>}
      </section>}
    </div>
  );
}
