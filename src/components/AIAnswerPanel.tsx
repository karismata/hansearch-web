import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AISearchResult } from '../lib/localAi';

interface Props {
  result: AISearchResult;
  onSave: (question: string, answer: string) => Promise<void>;
}

export function AIAnswerPanel({ result, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(result.query);
  const [answer, setAnswer] = useState(result.summary || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(question, answer);
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '답변 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 p-4 bg-violet-50 border border-violet-200 rounded-xl">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-bold text-violet-800">{result.saved_answer ? '저장된 수정 답변' : '한주AI 답변'}</p>
        {!editing && <button type="button" className="text-xs font-semibold text-violet-800 underline" onClick={() => {
          setQuestion(result.query); setAnswer(result.summary || ''); setError(''); setSaved(false); setEditing(true);
        }}>답변 수정·저장</button>}
      </div>
      {editing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700">저장할 검색어
            <input required maxLength={1000} disabled={saving} value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1 w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">올바른 답변
            <textarea required maxLength={20000} rows={7} disabled={saving} value={answer} onChange={(e) => setAnswer(e.target.value)} className="mt-1 w-full rounded-lg border border-violet-200 bg-white p-2 text-sm font-normal" />
          </label>
          <p className="text-xs text-slate-600">검색어와 답변을 한서치 자료로 저장합니다. 같은 질문의 AI 검색에는 이 답변을 우선 사용하며, 기존 답변이 있으면 갱신합니다.</p>
          {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded-lg px-3 py-2 text-xs text-slate-600">취소</button>
            <button type="submit" disabled={saving || !question.trim() || !answer.trim()} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? '저장 중...' : '수정 답변 저장'}</button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{result.summary?.trim() || '관련 자료는 찾았지만 한주AI 답변이 비어 있습니다. 답변을 직접 수정해 저장할 수 있습니다.'}</p>
          {(saved || result.saved_answer) && <p role="status" className="mt-2 text-xs text-violet-700">같은 질문에 재사용하는 답변입니다. ‘AI 검증답변’ 카테고리에서 수정·삭제할 수 있습니다.</p>}
        </>
      )}
    </div>
  );
}

