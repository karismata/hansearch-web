import { useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { Search, X, Filter, Star, Sparkles, Loader2, PlusCircle } from 'lucide-react';
import type { SortOption } from '../types';

interface SearchBarProps {
  query: string;
  onChangeQuery: (q: string) => void;
  onSearchSubmit: () => void;
  onAiSearchSubmit: () => void;
  onAddData: () => void;
  isAiSearching: boolean;
}

export function SearchBar({ query, onChangeQuery, onSearchSubmit, onAiSearchSubmit, onAddData, isAiSearching }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === '/' && !target?.closest('input, textarea, select, [contenteditable="true"]')) {
        event.preventDefault(); inputRef.current?.focus(); inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) onSearchSubmit();
  };
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search size={18} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
        <input ref={inputRef} type="text" aria-label="검색어" value={query} onChange={(event) => onChangeQuery(event.target.value)} onKeyDown={handleKeyDown}
          placeholder="검색어 입력 (단축키: /)" className="w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pl-9 pr-24 text-base font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none sm:pr-10 sm:text-sm" />
        {query && <button type="button" onClick={() => { onChangeQuery(''); inputRef.current?.focus(); }} aria-label="검색어 지우기" title="검색어 지우기" className="absolute inset-y-0 right-12 flex w-9 items-center justify-center text-slate-400 hover:text-slate-700 sm:right-1"><X size={16} /></button>}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:shrink-0">
        <button type="button" onClick={onSearchSubmit} className="flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-1.5 text-xs font-semibold text-white hover:bg-blue-700 sm:px-3 sm:text-sm"><Search size={16} className="hidden sm:block" /><span>검색</span></button>
        <button type="button" onClick={onAiSearchSubmit} disabled={isAiSearching || !query.trim()} title="한주AI로 관련 자료 검색" className="flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-violet-600 px-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm">
          {isAiSearching ? <Loader2 size={16} className="hidden animate-spin sm:block" /> : <Sparkles size={16} className="hidden sm:block" />}<span>AI 검색</span>
        </button>
        <button type="button" onClick={onAddData} className="flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-1.5 text-xs font-semibold text-white hover:bg-emerald-700 sm:px-3 sm:text-sm"><PlusCircle size={16} className="hidden sm:block" /><span>데이터 추가</span></button>
      </div>
    </div>
  );
}

interface SearchFilterProps {
  selectedCategory: string;
  onChangeCategory: (value: string) => void;
  categories: { name: string; count: number }[];
  sortOption: SortOption;
  onChangeSort: (value: SortOption) => void;
  showOnlyFavorites: boolean;
  onToggleFavorites: () => void;
}

export function SearchFilters({ selectedCategory, onChangeCategory, categories, sortOption, onChangeSort, showOnlyFavorites, onToggleFavorites }: SearchFilterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative">
          <Filter size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
          <select aria-label="카테고리" value={selectedCategory} onChange={(event) => onChangeCategory(event.target.value)} className="max-w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-6 text-xs text-slate-700">
            <option value="">카테고리 전체</option>{categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
          </select>
        </div>
        <button type="button" onClick={onToggleFavorites} aria-pressed={showOnlyFavorites} className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs ${showOnlyFavorites ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><Star size={13} />즐겨찾기</button>
      </div>
      <select aria-label="정렬" value={sortOption} onChange={(event) => onChangeSort(event.target.value as SortOption)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
        <option value="latest">최신순</option><option value="oldest">등록순</option><option value="title_asc">제목 오름차순</option><option value="title_desc">제목 내림차순</option>
      </select>
    </div>
  );
}

