import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AISearchResult } from '../lib/localAi';
import { HighlightText } from './HighlightText';

interface Props {
  result: AISearchResult;
  onSave: (question: string, answer: string) => Promise<void>;
  variant?: 'internal' | 'web';
}

export function AIAnswerPanel({ result, onSave, variant = 'internal' }: Props) {
  const sources = variant === 'web' ? result.web?.sources || [] : [];
  const legacyDump = variant === 'web' && result.summary.includes('본문 발췌 (해결 방법 검증 전)');
  const displayAnswer = legacyDump ? '자료는 찾았지만 답변 요약을 완료하지 못했습니다. 다시 검색하거나 출처·원문 보기를 확인해 주세요.' : result.summary;
  const editableAnswer = (displayAnswer || '') + (sources.length ? '\n\n참고 자료:\n' + sources.map(source => `[웹 자료 ${source.number}] ${source.title}\n${source.url}`).join('\n') : '');
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(result.query);
  const [answer, setAnswer] = useState(editableAnswer);
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
        <p className="text-xs font-bold text-violet-800">{result.saved_answer ? '저장된 수정 답변' : variant === 'web' ? legacyDump || result.web?.status === 'error' ? '인터넷 자료 확인 · 답변 정리 미완료' : sources.length ? '인터넷 자료 기반 추가 답변' : 'AI 일반 점검 · 현장 확인 필요' : '한주AI · 내부 자료 답변'}</p>
        {!editing && result.summary?.trim() && <button type="button" className="text-xs font-semibold text-violet-800 underline" onClick={() => {
          setQuestion(result.query); setAnswer(editableAnswer); setError(''); setSaved(false); setEditing(true);
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
          <div className="text-sm text-slate-700 whitespace-pre-wrap break-words"><HighlightText query="" text={displayAnswer?.trim() || '관련 자료는 찾았지만 한주AI 답변이 비어 있습니다. 답변을 직접 수정해 저장할 수 있습니다.'} /></div>
          {variant === 'internal' && result.coverage === 'partial' && <p className="mt-3 text-xs text-violet-700">일부 내용만 내부 자료로 확인했습니다. 부족한 내용은 인터넷에서 보완 검색할 수 있습니다.</p>}
          {sources.length > 0 && <div className="mt-3 border-t border-violet-200 pt-3 text-xs text-slate-600">
            <p className="mb-2 font-semibold text-violet-700">참고 링크{result.web?.cached ? ' · 최근 검색 재사용' : ''}</p>
            <div className="space-y-2">{sources.map(source => <div key={source.number}>
              <p className="font-medium">[{source.number}] {source.title}</p>
              <HighlightText query="" text={source.url} />
            </div>)}</div>
          </div>}
          {(sources.some(source => source.body_excerpt || source.evidence_quote) || legacyDump) && <details className="mt-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-violet-700">출처·원문 보기{sources.length > 0 ? ` (${sources.length})` : ''}{result.web?.cached ? ' · 최근 검색 재사용' : ''}</summary>
            <div className="mt-3 space-y-3">{sources.map(source => <div key={source.number}>
              {source.body_checked !== undefined && <span className="mb-1 inline-block rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-500">{source.body_checked ? '본문 확인' : '검색 요약만 확인'}</span>}
              {(source.body_excerpt || source.evidence_quote) && <blockquote className="mb-1 whitespace-pre-wrap border-l-2 border-violet-200 pl-2 text-slate-700">{source.body_excerpt || source.evidence_quote}</blockquote>}
              <p>[웹 자료 {source.number}] {source.title}</p>
            </div>)}
            {legacyDump && <div className="whitespace-pre-wrap break-words text-slate-500">{result.summary}</div>}</div>
          </details>}
          {(saved || result.saved_answer) && <p role="status" className="mt-2 text-xs text-violet-700">같은 질문에 재사용하는 답변입니다. ‘AI 검증답변’ 카테고리에서 수정·삭제할 수 있습니다.</p>}
        </>
      )}
    </div>
  );
}
