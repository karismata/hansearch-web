import React, { useRef, useEffect } from 'react';
import { Search, X, Filter, ArrowUpDown, Star } from 'lucide-react';
import type { SortOption } from '../types';


interface SearchBarProps {
  query: string;
  onChangeQuery: (q: string) => void;
  onSearchSubmit: () => void;
  selectedCategory: string;
  onChangeCategory: (cat: string) => void;
  categories: { name: string; count: number }[];
  sortOption: SortOption;
  onChangeSort: (sort: SortOption) => void;
  showOnlyFavorites: boolean;
  onToggleFavorites: () => void;
  favoriteCount: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onChangeQuery,
  onSearchSubmit,
  selectedCategory,
  onChangeCategory,
  categories,
  sortOption,
  onChangeSort,
  showOnlyFavorites,
  onToggleFavorites,
  favoriteCount,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClear = () => {
    onChangeQuery('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit();
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Top Main Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="제목(키워드2) 또는 내용에서 검색... (단축키: /)"
            className="w-full pl-10 pr-20 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all shadow-xs"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute inset-y-0 right-2 px-2 flex items-center text-slate-400 hover:text-slate-600"
              title="검색어 지우기"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search Action Button */}
        <button
          onClick={onSearchSubmit}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
        >
          <Search size={16} />
          <span>검색</span>
        </button>
      </div>

      {/* Filter and Sort Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Category Dropdown */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative w-full max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Filter size={14} />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => onChangeCategory(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors appearance-none cursor-pointer"
            >
              <option value="">카테고리 전체 ({categories.reduce((acc, c) => acc + c.count, 0)})</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name} ({cat.count})
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Favorite filter toggle */}
          <button
            onClick={onToggleFavorites}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 transition-all ${
              showOnlyFavorites
                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="즐겨찾기한 항목만 모아보기"
          >
            <Star size={13} className={showOnlyFavorites ? 'fill-current' : 'text-amber-500 fill-amber-500/30'} />
            <span>즐겨찾기 ({favoriteCount})</span>
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <ArrowUpDown size={13} />
            </div>
            <select
              value={sortOption}
              onChange={(e) => onChangeSort(e.target.value as SortOption)}
              className="pl-7 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors appearance-none cursor-pointer"
            >
              <option value="latest">정렬: 최신순</option>
              <option value="oldest">정렬: 등록순</option>
              <option value="title_asc">정렬: 제목 오름차순 (가나다)</option>
              <option value="title_desc">정렬: 제목 내림차순 (하파타)</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
