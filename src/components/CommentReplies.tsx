import { useEffect, useState } from 'react';
import { useAccount } from './AccountGate';
import { CommentEntry } from './CommentEntry';
import { addComment, deleteComment, fetchReplies, type InfoComment } from '../lib/comments';

export function CommentReplies({ infoId, parentId, defaultOpen = false, onCountDelta, focusComment }: {
  infoId: number; parentId: string; defaultOpen?: boolean; onCountDelta: (delta: number) => void; focusComment?: InfoComment;
}) {
  const { profile } = useAccount();
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState<InfoComment[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [retry, setRetry] = useState(0);
  const [focused, setFocused] = useState(focusComment);
  useEffect(() => {
    setFocused(focusComment);
    if (focusComment?.info_id === infoId && focusComment.parent_id === parentId) setOpen(true);
  }, [focusComment, infoId, parentId]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError('');
    fetchReplies(infoId, parentId).then(page => {
      if (active) { setRows(page.comments); setTotal(page.total); }
    }).catch(() => { if (active) setError('답글을 불러오지 못했습니다. 다시 시도해 주세요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, infoId, parentId, retry]);
  const mutate = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); }
    catch { setError('답글을 처리하지 못했습니다. 원래 댓글이 삭제되었거나 연결이 끊겼을 수 있습니다.'); }
    finally { setBusy(false); }
  };
  // Keep a directly fetched older target visible without advancing the page offset.
  const pinned = focused?.info_id === infoId && focused.parent_id === parentId ? rows.find(row => row.id === focused.id) || focused : undefined;
  const displayed = pinned ? [pinned, ...rows.filter(row => row.id !== pinned.id)] : rows;
  return <div className="mt-2">
    <button type="button" disabled={busy} aria-expanded={open} className="text-xs font-semibold text-blue-700" onClick={() => setOpen(value => !value)}>
      답글{total !== null ? ` ${total}개` : ''}{open ? ' 접기' : ' 보기·작성'}
    </button>
    {open && <div className="mt-2 ml-2 border-l-2 border-blue-100 pl-3 space-y-3" aria-label="답글 목록">
      {loading && <p role="status" className="text-xs text-slate-500">답글을 불러오는 중...</p>}
      {error && <div><p role="alert" className="text-xs text-rose-700">{error}</p><button type="button" disabled={busy || loading} className="text-xs text-blue-700" onClick={() => setRetry(n => n + 1)}>답글 다시 불러오기</button></div>}
      {!loading && displayed.map(reply => <article key={reply.id} className="rounded-lg bg-white p-3 text-sm">
        <CommentEntry comment={reply} highlighted={reply.id === focused?.id} busy={busy} onUpdated={updated => {
          setRows(items => items.map(item => item.id === updated.id ? updated : item));
          setFocused(item => item?.id === updated.id ? updated : item);
        }} onDelete={() => {
          if (window.confirm('이 답글을 삭제하시겠습니까?')) void mutate(async () => {
            await deleteComment(reply.id); setRows(items => items.filter(item => item.id !== reply.id));
            setFocused(item => item?.id === reply.id ? undefined : item);
            setTotal(n => Math.max(0, (n || 0) - 1)); onCountDelta(-1);
          });
        }} />
      </article>)}
      {!loading && rows.length < (total || 0) && <button type="button" disabled={busy} className="text-xs font-semibold text-blue-700" onClick={() => void mutate(async () => {
        const page = await fetchReplies(infoId, parentId, rows.length);
        setRows(items => [...new Map([...items, ...page.comments].map(item => [item.id, item])).values()]); setTotal(page.total);
      })}>답글 더 보기</button>}
      <form className="space-y-2" onSubmit={event => {
        event.preventDefault(); if (!body.trim() || busy || loading || total === null) return;
        void mutate(async () => {
          const added = await addComment(infoId, body, parentId);
          setRows(items => [added, ...items]); setTotal(n => (n || 0) + 1); setBody(''); onCountDelta(1);
        });
      }}>
        <label className="block text-xs font-semibold text-slate-600">{profile.username} 계정으로 답글 작성
          <textarea aria-label="답글 내용" required maxLength={4000} rows={2} value={body} disabled={busy || loading || total === null} onChange={event => setBody(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-normal" />
        </label>
        <div className="flex justify-end"><button disabled={busy || loading || total === null || !body.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">답글 등록</button></div>
      </form>
    </div>}
  </div>;
}
