import { useState, useEffect, useMemo, useCallback } from 'react';
import type { 
  InfoItem, 
  SupabaseConfig, 
  SortOption 
} from './types';
import { 
  getDefaultConfig, 
  saveConfig, 
  fetchAllItems, 
  insertItem, 
  updateItem, 
  deleteItem, 
} from './lib/supabase';
import { 
  getStoredFavorites, 
  saveStoredFavorites, 
  getStoredTags, 
  saveStoredTags,
  parseCategories
} from './utils/helpers';

import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { QuickTags } from './components/QuickTags';
import { ItemCard } from './components/ItemCard';
import { DataModal } from './components/DataModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { ImageLightbox } from './components/ImageLightbox';
import { AIAnswerPanel } from './components/AIAnswerPanel';
import { fetchSavedAiAnswer, saveAiAnswer } from './lib/savedAiAnswers';
import { AlertTriangle, Plus, SearchX, Loader2 } from 'lucide-react';
import { clearStoredAiToken, runAISearch, type AISearchResult, type AISearchStatus } from './lib/localAi';



export function App() {
  // Config & Connection State
  const [config, setConfig] = useState<SupabaseConfig>(() => {
    const def = getDefaultConfig();
    saveConfig(def);
    return def;
  });
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);


  // Data State
  const [items, setItems] = useState<InfoItem[]>([]);
  const [favorites, setFavorites] = useState<number[]>(getStoredFavorites());
  const [tags, setTags] = useState<string[]>(getStoredTags());

  // Search & Filter State
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('latest');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchStatus, setAiSearchStatus] = useState<AISearchStatus>('pending');
  const [aiSearchElapsedSeconds, setAiSearchElapsedSeconds] = useState(0);
  const [isAiSearchMode, setIsAiSearchMode] = useState(false);
  const [aiSearchResult, setAiSearchResult] = useState<AISearchResult | null>(null);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);

  // Modal States
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InfoItem | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);


  // Lightbox State
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Initial Data Load
  const loadData = useCallback(async (currentConfig?: SupabaseConfig) => {
    const targetConfig = currentConfig || config;
    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await fetchAllItems(targetConfig);
      setItems(data);
      setIsConnected(true);
    } catch (err: any) {
      console.error('Failed to load items:', err);
      setIsConnected(false);
      setLoadError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    clearStoredAiToken();
  }, []);

  useEffect(() => {
    if (!isAiSearching) return;
    const startedAt = Date.now();
    const updateElapsed = () => setAiSearchElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [isAiSearching]);

  // Favorites Management
  const handleToggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id];
      saveStoredFavorites(next);
      return next;
    });
  }, []);

  // Tags Management
  const handleUpdateTags = (newTags: string[]) => {
    setTags(newTags);
    saveStoredTags(newTags);
  };

  // Config Update
  const handleSaveConfig = (newConfig: SupabaseConfig) => {
    setConfig(newConfig);
    saveConfig(newConfig);
    loadData(newConfig);
  };

  // Search Submit
  const handleSearchSubmit = () => {
    setIsAiSearchMode(false);
    setAiSearchResult(null);
    setAiSearchError(null);
    setActiveSearch(searchInput.trim());
  };

  const handleAiSearchSubmit = async () => {
    const query = searchInput.trim();
    if (!query) return;
    setActiveSearch(query);
    setIsAiSearchMode(true);
    setAiSearchResult(null);
    setAiSearchError(null);
    setAiSearchStatus('pending');
    setAiSearchElapsedSeconds(0);
    setIsAiSearching(true);
    try {
      const saved = await fetchSavedAiAnswer(query, config);
      if (saved) {
        setItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
        setAiSearchResult({ query, summary: saved.내용, saved_answer: true,
          results: saved.id ? [{ id: saved.id, score: 1 }] : [], synced_count: items.length });
      } else {
        setAiSearchResult(await runAISearch(query, setAiSearchStatus));
      }
    } catch (error: any) {
      setAiSearchError(error?.message || 'AI 검색에 실패했습니다.');
      setIsAiSearchMode(false);
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleSaveAiCorrection = async (question: string, answer: string) => {
    const saved = await saveAiAnswer(question, answer, config);
    setItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
    setSearchInput(question.trim());
    setActiveSearch(question.trim());
    setAiSearchResult({ query: question.trim(), summary: saved.내용, saved_answer: true,
      results: saved.id ? [{ id: saved.id, score: 1 }] : [], synced_count: items.length });
  };

  // Quick Tag Click
  const handleSelectTag = (tag: string) => {
    setIsAiSearchMode(false);
    setAiSearchResult(null);
    setSearchInput(tag);
    setActiveSearch(tag);
  };

  // Categories Calculation (handles semicolon delimited categories)
  const categoriesWithCount = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      const cats = parseCategories(item.키워드);
      cats.forEach((c) => {
        map.set(c, (map.get(c) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const uniqueCategoryNames = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      parseCategories(i.키워드).forEach((c) => set.add(c));
    });
    return Array.from(set);
  }, [items]);

  // Filtered & Sorted Items
  const filteredItems = useMemo(() => {
    // Split on whitespace so every typed term must match somewhere across the item.
    const searchTerms = activeSearch
      .split(/\s+/)
      .map((term) => term.trim().toLowerCase().replace(/^#/, ''))
      .filter(Boolean);

    return items
      .filter((item) => {
        // Category Filter (check if selected category exists in item's categories)
        if (selectedCategory) {
          const itemCats = parseCategories(item.키워드);
          if (!itemCats.includes(selectedCategory)) {
            return false;
          }
        }

        // Favorites Filter
        const isFav = favorites.includes(item.id!) || !!item.중요;
        if (showOnlyFavorites && !isFav) {
          return false;
        }


        // Keyword Search (키워드2 and 내용)
        if (searchTerms.length > 0 && !isAiSearchMode) {
          const title = (item.키워드2 || '').toLowerCase();
          const content = (item.내용 || '').toLowerCase();
          const keyword = (item.키워드 || '').toLowerCase();
          const searchableText = `${title}\n${content}\n${keyword}`;
          return searchTerms.every((term) => searchableText.includes(term));
        }

        return true;
      })
      .sort((a, b) => {
        // Favorites to top if not specifically sorting by title
        if (sortOption === 'latest') {
          const timeA = new Date(a.created_at || 0).getTime() || (a.id || 0);
          const timeB = new Date(b.created_at || 0).getTime() || (b.id || 0);
          return timeB - timeA;
        } else if (sortOption === 'oldest') {
          const timeA = new Date(a.created_at || 0).getTime() || (a.id || 0);
          const timeB = new Date(b.created_at || 0).getTime() || (b.id || 0);
          return timeA - timeB;
        } else if (sortOption === 'title_asc') {
          return (a.키워드2 || '').localeCompare(b.키워드2 || '', 'ko');
        } else if (sortOption === 'title_desc') {
          return (b.키워드2 || '').localeCompare(a.키워드2 || '', 'ko');
        }
        return 0;
      });
  }, [items, activeSearch, selectedCategory, showOnlyFavorites, favorites, sortOption, isAiSearchMode]);

  const visibleItems = useMemo(() => {
    if (!isAiSearchMode) return filteredItems;
    if (!aiSearchResult) return [];
    const byId = new Map(filteredItems.map((item) => [Number(item.id), item]));
    const seen = new Set<number>();
    return aiSearchResult.results
      .map((result) => byId.get(Number(result.id)))
      .filter((item): item is InfoItem => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
  }, [filteredItems, aiSearchResult, isAiSearchMode]);

  // CRUD Actions
  const handleSaveItem = async (itemData: Omit<InfoItem, 'id' | 'created_at'>) => {
    if (editingItem && editingItem.id) {
      // Update
      const updated = await updateItem(editingItem.id, itemData, config);
      setItems((prev) => prev.map((item) => (item.id === editingItem.id ? updated : item)));
    } else {
      // Insert
      const inserted = await insertItem(itemData, config);
      setItems((prev) => [inserted, ...prev]);
    }
  };

  const handleDeleteItem = useCallback(async (id: number) => {
    if (!window.confirm('이 항목을 정말 삭제하시겠습니까?')) return;
    try {
      await deleteItem(id, config);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setFavorites((prev) => prev.filter((favId) => favId !== id));
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  }, [config]);

  // Open Lightbox

  const handleOpenImage = useCallback((images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  }, []);

  const handleEditItem = useCallback((target: InfoItem) => {
    setEditingItem(target);
    setIsDataModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <Header
        isConnected={isConnected}
        totalCount={items.length}
        filteredCount={visibleItems.length}
        isLoading={isLoading}
        onRefresh={() => loadData()}
        onOpenAddModal={() => {
          setEditingItem(null);
          setIsDataModalOpen(true);
        }}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
      />


      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 flex-1 flex flex-col space-y-4">
        {/* Search & Filter Card */}
        <section className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <SearchBar
            query={searchInput}
            onChangeQuery={(q) => {
              setSearchInput(q);
              if (q === '') setActiveSearch('');
              setIsAiSearchMode(false);
              setAiSearchResult(null);
              setAiSearchError(null);
            }}
            onSearchSubmit={handleSearchSubmit}
            onAiSearchSubmit={handleAiSearchSubmit}
            isAiSearching={isAiSearching}
            selectedCategory={selectedCategory}
            onChangeCategory={setSelectedCategory}
            categories={categoriesWithCount}
            sortOption={sortOption}
            onChangeSort={setSortOption}
            showOnlyFavorites={showOnlyFavorites}
            onToggleFavorites={() => setShowOnlyFavorites(!showOnlyFavorites)}
            favoriteCount={favorites.length}
          />

          {/* Quick Search Tag Chips */}
          <div className="pt-2 border-t border-slate-100">
            <QuickTags
              tags={tags}
              activeSearch={activeSearch}
              onSelectTag={handleSelectTag}
              onUpdateTags={handleUpdateTags}
            />
          </div>
        </section>

        {/* Database / Connection Error Alert */}
        {loadError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">Supabase 연결 오류</p>
                <p>{loadError}</p>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium shrink-0 transition-colors shadow-2xs"
            >
              설정 열기
            </button>
          </div>
        )}

        {/* Search Results Area */}
        <section className="flex-1 flex flex-col">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-blue-600">{isAiSearchMode ? '✨' : '🔍'}</span> {isAiSearchMode ? 'AI 검색 결과' : '검색 결과'}
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-full">
                {visibleItems.length}건
              </span>
            </div>

            {activeSearch && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>검색어:</span>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 font-bold rounded-md border border-yellow-200">
                  "{activeSearch}"
                </span>
                <button
                  onClick={() => {
                    setSearchInput('');
                    setActiveSearch('');
                  }}
                  className="text-slate-400 hover:text-slate-700 underline ml-1"
                >
                  초기화
                </button>
              </div>
            )}
          </div>

          {aiSearchError && (
            <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {aiSearchError}
            </div>
          )}

          {isAiSearching && (
            <div className="mb-3 p-4 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-3 text-violet-800">
              <Loader2 size={18} className="animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {aiSearchStatus === 'pending' ? '한주AI 연결 대기 중' : '한주AI가 자료를 분석 중'}
                  <span className="ml-2 text-xs font-medium text-violet-600">{aiSearchElapsedSeconds}초</span>
                </p>
                <p className="text-xs text-violet-600 mt-0.5">첫 검색은 준비하는 데 더 걸릴 수 있습니다. 완료되면 답변이 표시됩니다.</p>
              </div>
            </div>
          )}

          {isAiSearchMode && aiSearchResult && (
            <AIAnswerPanel key={aiSearchResult.query} result={aiSearchResult} onSave={handleSaveAiCorrection} />
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Loader2 size={36} className="text-blue-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">데이터를 불러오는 중입니다...</p>
              <p className="text-xs text-slate-400 mt-1">Supabase에서 실시간 동기화 중</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isAiSearching && visibleItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-center">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl mb-3">
                <SearchX size={40} />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {isAiSearchMode ? 'AI 관련 자료를 찾지 못했습니다' : activeSearch ? `"${activeSearch}" 검색 결과가 없습니다` : '등록된 데이터가 없습니다'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                {isAiSearchMode
                  ? '다른 표현으로 AI 검색을 다시 시도하거나 일반 검색을 이용해 보세요.'
                  : activeSearch
                  ? '다른 키워드로 검색하거나 카테고리 필터를 변경해 보세요.'
                  : '상단의 [데이터 추가] 버튼을 눌러 새 가이드를 등록해 보세요.'}
              </p>

              <div className="flex items-center gap-2">
                {activeSearch || isAiSearchMode ? (
                  <button
                    onClick={() => {
                      setSearchInput('');
                      setActiveSearch('');
                      setSelectedCategory('');
                      setIsAiSearchMode(false);
                      setAiSearchResult(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    필터 전체 초기화
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setIsDataModalOpen(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus size={15} />
                    <span>첫 데이터 등록하기</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cards Grid / List */}
          {!isLoading && visibleItems.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5">
              {visibleItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  searchQuery={activeSearch}
                  isFavorite={favorites.includes(item.id!)}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onOpenImage={handleOpenImage}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modals */}
      <DataModal
        isOpen={isDataModalOpen}
        onClose={() => {
          setIsDataModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        editingItem={editingItem}
        categoryList={uniqueCategoryNames.length > 0 ? uniqueCategoryNames : ['공통']}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />


      <ImageLightbox
        isOpen={isLightboxOpen}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        onClose={() => setIsLightboxOpen(false)}
      />
    </div>
  );
}

export default App;

