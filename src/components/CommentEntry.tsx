import { useEffect, useRef, useState } from 'react';
import { useAccount } from './AccountGate';
import { HighlightText } from './HighlightText';
import { editComment, type InfoComment } from '../lib/comments';
import { formatDate } from '../utils/helpers';

export function CommentEntry({ comment, busy, onDelete, onUpdated, highlighted = false }: {
  comment: InfoComment; busy: boolean; onDelete: () => void; onUpdated: (comment: InfoComment) => void; highlighted?: boolean;
}) {
  const { profile } = useAccount();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) {
      element.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
      element.current?.focus({ preventScroll: true });
    }
  }, [highlighted]);
  const disabled = busy || saving;
  return <div ref={element} data-comment-id={comment.id} tabIndex={highlighted ? -1 : undefined} className={highlighted ? 'scroll-mt-44 rounded-lg bg-blue-50 p-2 ring-2 ring-blue-400 outline-none' : undefined}>
    {highlighted && <p className="mb-2 text-xs font-bold text-blue-700">{comment.parent_id ? '알림의 답글' : '알림의 댓글'}</p>}
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <span><strong className="text-slate-700">{comment.author_username}</strong> · {formatDate(comment.created_at)}{comment.updated_at ? ' · 수정됨' : ''}</span>
      <div className="flex gap-3">
        {comment.author_id === profile.id && <button type="button" disabled={disabled} onClick={() => { setDraft(comment.body); setEditing(true); setError(''); }} className="text-blue-700">수정</button>}
        {(comment.author_id === profile.id || profile.role === 'master') && <button type="button" disabled={disabled} className="text-slate-600" onClick={onDelete}>삭제</button>}
      </div>
    </div>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    {editing ? <form onSubmit={async event => {
      event.preventDefault(); if (!draft.trim() || disabled) return;
      setSaving(true); setError('');
      try { onUpdated(await editComment(comment.id, draft)); setEditing(false); }
      catch { setError('댓글을 수정하지 못했습니다. 권한과 연결 상태를 확인해 주세요.'); }
      finally { setSaving(false); }
    }}>
      <textarea aria-label="댓글 수정" required maxLength={4000} rows={3} value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2" />
      <div className="mt-2 flex justify-end gap-3 text-xs"><button type="button" disabled={disabled} onClick={() => setEditing(false)}>취소</button><button disabled={disabled || !draft.trim()} className="font-semibold text-blue-700">저장</button></div>
    </form> : <div className="whitespace-pre-wrap break-words text-slate-700"><HighlightText text={comment.body} query="" /></div>}
  </div>;
}
