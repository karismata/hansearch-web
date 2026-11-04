import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAccount } from './AccountGate';
import { HighlightText } from './HighlightText';
import { addComment, deleteComment, editComment, fetchComments, type InfoComment } from '../lib/comments';
import { formatDate } from '../utils/helpers';

export function ItemComments({ infoId, onTotalChange }: { infoId: number; onTotalChange?: (total: number) => void }) {
  const { profile } = useAccount();
  const [comments, setComments] = useState<InfoComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    fetchComments(infoId).then(page => {
      if (active) { setComments(page.comments); setTotal(page.total); }
    }).catch(() => { if (active) setError('댓글을 불러오지 못했습니다. 다시 시도해 주세요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [infoId, retry]);

  useEffect(() => {
    if (!loading && !error) onTotalChange?.(total);
  }, [total, loading, error, onTotalChange]);

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
      setComments(rows => [added, ...rows]); setTotal(n => n + 1); setBody('');
      onTotalChange?.(total + 1);
    });
  };
  return <section aria-label="자료 댓글" className="mt-3 border-t border-slate-100 pt-3 space-y-3">
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>댓글 {!loading && ` ${total}개`}</span>
      <button type="button" disabled={busy || loading} onClick={() => setRetry(n => n + 1)} className="text-blue-700 disabled:opacity-50">새로고침</button>
    </div>
    {loading && <p role="status" className="text-xs text-slate-500">댓글을 불러오는 중...</p>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    {!loading && !error && comments.length === 0 && <p className="text-xs text-slate-500">처리 경험이나 추가 확인 내용을 남겨 주세요.</p>}
    {comments.map(comment => <article key={comment.id} className="rounded-lg bg-slate-50 p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span><strong className="text-slate-700">{comment.author_username}</strong> · {formatDate(comment.created_at)}{comment.updated_at ? ' · 수정됨' : ''}</span>
        <div className="flex gap-3">
          {comment.author_id === profile.id && <button type="button" disabled={busy} onClick={() => { setEditingId(comment.id); setDraft(comment.body); }} className="text-blue-700">수정</button>}
          {(comment.author_id === profile.id || profile.role === 'master') && <button type="button" disabled={busy} className="text-slate-600" onClick={() => {
            if (window.confirm('이 댓글을 삭제하시겠습니까?')) void mutate(async () => {
              await deleteComment(comment.id); setComments(rows => rows.filter(row => row.id !== comment.id)); setTotal(n => Math.max(0, n - 1));
              onTotalChange?.(Math.max(0, total - 1));
              if (editingId === comment.id) setEditingId(null);
            });
          }}>삭제</button>}
        </div>
      </div>
      {editingId === comment.id ? <form onSubmit={event => {
        event.preventDefault(); if (!draft.trim() || busy) return;
        void mutate(async () => { const updated = await editComment(comment.id, draft); setComments(rows => rows.map(row => row.id === updated.id ? updated : row)); setEditingId(null); });
      }}>
        <textarea aria-label="댓글 수정" required maxLength={4000} rows={3} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2" />
        <div className="mt-2 flex justify-end gap-3 text-xs"><button type="button" disabled={busy} onClick={() => setEditingId(null)}>취소</button><button disabled={busy || !draft.trim()} className="font-semibold text-blue-700">저장</button></div>
      </form> : <div className="whitespace-pre-wrap break-words text-slate-700"><HighlightText text={comment.body} query="" /></div>}
    </article>)}
    {comments.length < total && <button type="button" disabled={busy || loading} className="text-xs font-semibold text-blue-700" onClick={() => void mutate(async () => {
      const page = await fetchComments(infoId, comments.length);
      setComments(rows => [...new Map([...rows, ...page.comments].map(row => [row.id, row])).values()]); setTotal(page.total);
    })}>댓글 더 보기</button>}
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-xs font-semibold text-slate-600">{profile.username} 계정으로 댓글 작성
        <textarea aria-label="댓글 내용" required maxLength={4000} rows={2} value={body} disabled={busy || loading} onChange={event => setBody(event.target.value)} placeholder="처리 경험이나 보완 내용을 입력하세요." className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-normal" />
      </label>
      <div className="flex justify-end"><button disabled={busy || loading || !body.trim()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? '처리 중...' : '댓글 등록'}</button></div>
    </form>
  </section>;
}
