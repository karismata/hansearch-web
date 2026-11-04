import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAccount } from './AccountGate';
import { CommentEntry } from './CommentEntry';
import { CommentReplies } from './CommentReplies';
import { addComment, deleteComment, fetchComments, fetchCommentTotal, type InfoComment } from '../lib/comments';

export function ItemComments({ infoId, onTotalChange, threadId, notificationComment }: {
  infoId: number; onTotalChange?: (total: number) => void; threadId?: string; notificationComment?: InfoComment;
}) {
  const { profile } = useAccount();
  const [comments, setComments] = useState<InfoComment[]>([]);
  const [total, setTotal] = useState(0);
  const totalRef = useRef(0);
  const [rootTotal, setRootTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    fetchComments(infoId, 0, threadId).then(page => {
      if (active) { setComments(page.comments); setRootTotal(page.rootTotal); setTotal(page.total); totalRef.current = page.total; }
    }).catch(() => { if (active) setError('댓글을 불러오지 못했습니다. 다시 시도해 주세요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [infoId, threadId, retry]);

  useEffect(() => {
    if (!loading && !error) onTotalChange?.(total);
  }, [total, loading, error, onTotalChange]);

  const replaceTotal = (value: number) => {
    totalRef.current = Math.max(0, value); setTotal(totalRef.current); onTotalChange?.(totalRef.current);
  };
  const mutate = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); }
    catch { setError('댓글을 저장하거나 삭제하지 못했습니다. 권한과 연결 상태를 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || busy || loading) return;
    void mutate(async () => {
      const added = await addComment(infoId, body);
      setComments(rows => [added, ...rows]); setRootTotal(n => n + 1); setBody('');
      replaceTotal(totalRef.current + 1);
    });
  };
  return <section aria-label="자료 댓글" className="mt-3 border-t border-slate-100 pt-3 space-y-3">
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>{threadId ? '알림의 댓글' : '댓글'} {!loading && !threadId && (' ' + total + '개 · 답글 포함')}</span>
      <button type="button" disabled={busy || loading} onClick={() => setRetry(n => n + 1)} className="text-blue-700 disabled:opacity-50">새로고침</button>
    </div>
    {loading && <p role="status" className="text-xs text-slate-500">댓글을 불러오는 중...</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    {!loading && !error && comments.length === 0 && <p className="text-xs text-slate-500">{threadId ? '삭제되었거나 확인할 수 없는 댓글입니다.' : '처리 경험이나 추가 확인 내용을 남겨 주세요.'}</p>}
    {!loading && comments.map(comment => <article key={comment.id} className="rounded-lg bg-slate-50 p-3 text-sm">
      <CommentEntry comment={comment} highlighted={comment.id === notificationComment?.id} busy={busy} onUpdated={updated => setComments(rows => rows.map(row => row.id === updated.id ? updated : row))} onDelete={() => {
        if (window.confirm('이 댓글과 달린 답글을 함께 삭제하시겠습니까?')) void mutate(async () => {
          await deleteComment(comment.id);
          setComments(rows => rows.filter(row => row.id !== comment.id)); setRootTotal(n => Math.max(0, n - 1));
          // The DB cascades replies, including pages that were never opened.
          try { replaceTotal(await fetchCommentTotal(infoId)); }
          catch { setRetry(n => n + 1); }
        });
      }} />
      <CommentReplies infoId={infoId} parentId={comment.id} defaultOpen={comment.id === threadId} focusComment={notificationComment?.parent_id === comment.id ? notificationComment : undefined} onCountDelta={delta => replaceTotal(totalRef.current + delta)} />
    </article>)}
    {!threadId && comments.length < rootTotal && <button type="button" disabled={busy || loading} className="text-xs font-semibold text-blue-700" onClick={() => void mutate(async () => {
      const page = await fetchComments(infoId, comments.length);
      setComments(rows => [...new Map([...rows, ...page.comments].map(row => [row.id, row])).values()]); setRootTotal(page.rootTotal); replaceTotal(page.total);
    })}>댓글 더 보기</button>}
    {!threadId && <form onSubmit={submit} className="space-y-2">
      <label className="block text-xs font-semibold text-slate-600">{profile.username} 계정으로 댓글 작성
        <textarea aria-label="댓글 내용" required maxLength={4000} rows={2} value={body} disabled={busy || loading} onChange={event => setBody(event.target.value)} placeholder="처리 경험이나 보완 내용을 입력하세요." className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-normal" />
      </label>
      <div className="flex justify-end"><button disabled={busy || loading || !body.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? '처리 중...' : '댓글 등록'}</button></div>
    </form>}
  </section>;
}
