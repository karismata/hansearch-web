import { useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { Search, X, Filter, Star, Sparkles, Loader2, PlusCircle, ChevronDown } from 'lucide-react';
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
          placeholder="검색어 입력 (단축키: /)" className="w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pl-9 pr-10 text-base font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none sm:text-sm" />
        {query && <button type="button" onClick={() => { onChangeQuery(''); inputRef.current?.focus(); }} aria-label="검색어 지우기" title="검색어 지우기" className="absolute inset-y-0 right-1 flex w-9 items-center justify-center text-slate-400 hover:text-slate-700"><X size={16} /></button>}
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
  const controlClass = 'h-11 w-full min-w-0 rounded-lg border text-base font-medium leading-5 focus-visible:outline-2 focus-visible:outline-blue-500 sm:text-sm';
  const normalColors = 'border-slate-200 bg-white text-slate-700';
  return (
    <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-3">
        <div className="relative col-span-2 min-w-0 sm:col-span-1">
          <Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <select aria-label="카테고리" value={selectedCategory} onChange={(event) => onChangeCategory(event.target.value)} className={`${controlClass} ${normalColors} appearance-none truncate py-0 pl-9 pr-9`}>
            <option value="">카테고리 전체</option>{categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        </div>
        <button type="button" onClick={onToggleFavorites} aria-pressed={showOnlyFavorites} className={`${controlClass} flex items-center justify-center gap-2 px-3 ${showOnlyFavorites ? 'border-amber-500 bg-amber-50 text-amber-800' : `${normalColors} hover:bg-slate-50`}`}><Star size={16} className="shrink-0" aria-hidden="true" />즐겨찾기</button>
      <div className="relative min-w-0">
        <select aria-label="정렬" value={sortOption} onChange={(event) => onChangeSort(event.target.value as SortOption)} className={`${controlClass} ${normalColors} appearance-none truncate py-0 pl-3 pr-9`}>
          <option value="latest">최신순</option><option value="oldest">등록순</option><option value="title_asc">제목순 ↑</option><option value="title_desc">제목순 ↓</option>
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      </div>
    </div>
  );
}

