import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { useAndroidBack } from './lib/androidBack';
import { SearchBar, SearchFilters } from './components/SearchBar';
import { ScrollToTop } from './components/ScrollToTop';
import { useAccount } from './components/AccountGate';
import { AccountAdmin } from './components/AccountAdmin';
import { AccountPassword } from './components/AccountPassword';
import { recordSearch } from './lib/accounts';
import { fetchNotificationContext, type CommentNotification, type NotificationContext } from './lib/notifications';
import { QuickTags } from './components/QuickTags';
import { ItemCard } from './components/ItemCard';
import { DataModal } from './components/DataModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { ImageLightbox } from './components/ImageLightbox';
import { AIAnswerPanel } from './components/AIAnswerPanel';
import { fetchSavedAiAnswer, saveAiAnswer } from './lib/savedAiAnswers';
import { AlertTriangle, Plus, SearchX, Loader2 } from 'lucide-react';
import { clearStoredAiToken, runAISearch, type AISearchResult, type AISearchStatus, type WebAnswer } from './lib/localAi';



export function App() {
  const { profile, signOut } = useAccount();
  const [isAccountAdminOpen, setIsAccountAdminOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [activityWarning, setActivityWarning] = useState('');
  const logSearch = (kind: 'search' | 'ai_search') => {
    void recordSearch(kind).then(() => setActivityWarning('')).catch(() => setActivityWarning('일부 검색 통계를 기록하지 못했습니다. 연결 상태를 확인해 주세요.'));
  };
  // Config & Connection State
  const [config, setConfig] = useState<SupabaseConfig>(getDefaultConfig);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);


  // Data State
  const [items, setItems] = useState<InfoItem[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
  const [notificationView, setNotificationView] = useState<{ notification: CommentNotification; context?: NotificationContext; error?: string } | null>(null);
  const handleCommentCountChange = useCallback((id: number, total: number) => {
    setCommentCounts(current => current[id] === total ? current : { ...current, [id]: total });
  }, []);
  const [favorites, setFavorites] = useState<number[]>(getStoredFavorites());
  const [tags, setTags] = useState<string[]>(getStoredTags());

  // Search & Filter State
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('latest');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);
  const [searchOptionsOpen, setSearchOptionsOpen] = useState(() => {
    try { return localStorage.getItem('hansearch_search_options_open') === 'true'; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('hansearch_search_options_open', String(searchOptionsOpen)); }
    catch { /* Layout preferences remain usable when storage is unavailable. */ }
  }, [searchOptionsOpen]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchStatus, setAiSearchStatus] = useState<AISearchStatus>('pending');
  const [aiSearchElapsedSeconds, setAiSearchElapsedSeconds] = useState(0);
  const [isAiSearchMode, setIsAiSearchMode] = useState(false);
  const [aiSearchResult, setAiSearchResult] = useState<AISearchResult | null>(null);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [webAnswer, setWebAnswer] = useState<WebAnswer | null>(null);
  const [isWebSearching, setIsWebSearching] = useState(false);
  const [webSearchStatus, setWebSearchStatus] = useState<AISearchStatus>('pending');
  const [webSearchError, setWebSearchError] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const requestVersion = useRef(0);
  const aiAbort = useRef<AbortController | null>(null);
  const webAbort = useRef<AbortController | null>(null);
  const webStarted = useRef(false);
  const aiJobId = useRef<string | undefined>(undefined);

  const resetAiRequests = () => {
    setNotificationView(null);
    requestVersion.current += 1;
    aiAbort.current?.abort(); webAbort.current?.abort();
    webStarted.current = false;
    aiJobId.current = undefined;
    setIsAiSearching(false); setIsWebSearching(false);
    setWebAnswer(null); setWebSearchError(''); setAiQuery('');
  };
  useEffect(() => () => { aiAbort.current?.abort(); webAbort.current?.abort(); }, []);

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
      setCommentCounts(Object.fromEntries(data.filter(item => item.id != null).map(item => [item.id!, item.comment_count || 0])));
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
  const handleGoHome = () => {
    resetAiRequests();
    setSearchInput('');
    setActiveSearch('');
    setSelectedCategory('');
    setSortOption('latest');
    setShowOnlyFavorites(false);
    setIsAiSearchMode(false);
    setAiSearchResult(null);
    setAiSearchError(null);
    setAiSearchStatus('pending');
    setAiSearchElapsedSeconds(0);
    setWebSearchStatus('pending');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  useAndroidBack(() => {
    if (document.querySelector('[data-native-back-busy="true"]')) return 'busy';
    const closePanels = new window.Event('hansearch-back', { cancelable: true });
    window.dispatchEvent(closePanels);
    const hasOverlay = isLightboxOpen || isDataModalOpen || isSettingsModalOpen || isHelpModalOpen || isAccountAdminOpen || isPasswordOpen;
    const awayFromHome = searchInput || activeSearch || selectedCategory || sortOption !== 'latest' || showOnlyFavorites ||
      isAiSearchMode || isAiSearching || isWebSearching || notificationView || searchOptionsOpen || window.scrollY > 4;
    if (hasOverlay || awayFromHome) {
      setIsLightboxOpen(false);
      setIsDataModalOpen(false); setEditingItem(null);
      setIsSettingsModalOpen(false); setIsHelpModalOpen(false);
      setIsAccountAdminOpen(false); setIsPasswordOpen(false);
      setSearchOptionsOpen(false);
      handleGoHome();
      return 'handled';
    }
    return closePanels.defaultPrevented ? 'handled' : 'home';
  });

  const handleSearchSubmit = () => {
    resetAiRequests();
    if (searchInput.trim()) logSearch('search');
    setIsAiSearchMode(false);
    setAiSearchResult(null);
    setAiSearchError(null);
    setActiveSearch(searchInput.trim());
  };

  const handleOpenNotification = async (notification: CommentNotification) => {
    handleGoHome();
    const version = requestVersion.current;
    setNotificationView({ notification });
    try {
      const context = await fetchNotificationContext(notification);
      if (version !== requestVersion.current) return;
      setItems(rows => [context.item, ...rows.filter(row => row.id !== context.item.id)]);
      setNotificationView({ notification, context });
    } catch (error) {
      if (version === requestVersion.current) setNotificationView({ notification, error: error instanceof Error ? error.message : '알림의 자료와 댓글을 불러오지 못했습니다.' });
    }
  };

  const handleAiSearchSubmit = async () => {
    const query = searchInput.trim();
    if (!query) return;
    resetAiRequests();
    const version = requestVersion.current;
    const controller = new AbortController();
    aiAbort.current = controller;
    setAiQuery(query);
    logSearch('ai_search');
    setActiveSearch(query);
    setIsAiSearchMode(true);
    setAiSearchResult(null);
    setAiSearchError(null);
    setAiSearchStatus('pending');
    setAiSearchElapsedSeconds(0);
    setIsAiSearching(true);
    try {
      const saved = await fetchSavedAiAnswer(query, config);
      if (version !== requestVersion.current) return;
      if (saved) {
        setItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
        setAiSearchResult({ query, summary: saved.내용, saved_answer: true,
          results: saved.id ? [{ id: saved.id, score: 1 }] : [], synced_count: items.length });
      } else {
        const result = await runAISearch(query, status => {
          if (version === requestVersion.current) setAiSearchStatus(status);
        }, { signal: controller.signal, onCreated: id => {
          if (version === requestVersion.current) aiJobId.current = id;
        }, onProgress: result => {
          if (version === requestVersion.current) setAiSearchResult(result);
        } });
        if (version !== requestVersion.current) return;
        setAiSearchResult(result);
        if (!webStarted.current && result.web) setWebAnswer(result.web);
      }
    } catch (error: any) {
      if (version !== requestVersion.current || controller.signal.aborted) return;
      setAiSearchError(error?.message || 'AI 검색에 실패했습니다.');
    } finally {
      if (version === requestVersion.current) setIsAiSearching(false);
    }
  };

  const handleWebSearch = async () => {
    if (!aiQuery || webStarted.current && isWebSearching) return;
    const version = requestVersion.current;
    webStarted.current = true;
    webAbort.current?.abort();
    const controller = new AbortController(); webAbort.current = controller;
    setIsWebSearching(true); setWebSearchError(''); setWebSearchStatus('pending');
    try {
      const result = await runAISearch(aiQuery, status => {
        if (version === requestVersion.current) setWebSearchStatus(status);
      }, { mode: 'web', signal: controller.signal, parentId: aiJobId.current });
      if (version !== requestVersion.current) return;
      if (!result.web) throw new Error('한주AI 서버를 최신 버전으로 업데이트한 뒤 다시 시도해 주세요.');
      setWebAnswer(result.web);
    } catch (error) {
      if (version === requestVersion.current && !controller.signal.aborted) setWebSearchError(error instanceof Error ? error.message : '인터넷 검색에 실패했습니다.');
    } finally {
      if (version === requestVersion.current) setIsWebSearching(false);
    }
  };

  const handleSaveAiCorrection = async (question: string, answer: string) => {
    const version = requestVersion.current;
    const saved = await saveAiAnswer(question, answer, config);
    if (version !== requestVersion.current) return;
    resetAiRequests(); setAiQuery(question.trim());
    setItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
    setSearchInput(question.trim());
    setActiveSearch(question.trim());
    setAiSearchResult({ query: question.trim(), summary: saved.내용, saved_answer: true,
      results: saved.id ? [{ id: saved.id, score: 1 }] : [], synced_count: items.length });
  };

  // Quick Tag Click
  const handleSelectTag = (tag: string) => {
    resetAiRequests();
    if (tag.trim()) logSearch('search');
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
    if (notificationView) return notificationView.context ? items.filter(item => item.id === notificationView.notification.info_id) : [];
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
  }, [filteredItems, aiSearchResult, isAiSearchMode, notificationView, items]);

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
      setNotificationView(view => view?.notification.info_id === id ? null : view);
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
        onGoHome={handleGoHome}
        onOpenNotification={notification => void handleOpenNotification(notification)}
        isConnected={isConnected}
        totalCount={items.length}
        filteredCount={visibleItems.length}
        isLoading={isLoading}
        onRefresh={() => loadData()}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        username={profile.username}
        isMaster={profile.role === 'master'}
        onOpenAccounts={() => setIsAccountAdminOpen(true)}
        onChangePassword={() => setIsPasswordOpen(true)}
        onSignOut={() => void signOut()}
        activityWarning={activityWarning}
        filtersOpen={searchOptionsOpen}
        activeFilterCount={Number(Boolean(selectedCategory)) + Number(showOnlyFavorites) + Number(sortOption !== 'latest')}
        onToggleFilters={() => setSearchOptionsOpen(open => !open)}
      >
        <SearchBar
          query={searchInput}
          onChangeQuery={(q) => {
            resetAiRequests();
            setSearchInput(q);
            if (q === '') setActiveSearch('');
            setIsAiSearchMode(false);
            setAiSearchResult(null);
            setAiSearchError(null);
          }}
          onSearchSubmit={handleSearchSubmit}
          onAiSearchSubmit={handleAiSearchSubmit}
          onAddData={() => {
            setEditingItem(null);
            setIsDataModalOpen(true);
          }}
          isAiSearching={isAiSearching}
        />
      </Header>
      <ScrollToTop />


      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 flex-1 flex flex-col space-y-4">
        {/* Search & Filter Card */}
        <section id="search-options-panel" aria-label="검색 옵션 및 자주 찾는 검색어" hidden={!searchOptionsOpen} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <SearchFilters
            selectedCategory={selectedCategory}
            onChangeCategory={value => { if (notificationView) resetAiRequests(); setSelectedCategory(value); }}
            categories={categoriesWithCount}
            sortOption={sortOption}
            onChangeSort={value => { if (notificationView) resetAiRequests(); setSortOption(value); }}
            showOnlyFavorites={showOnlyFavorites}
            onToggleFavorites={() => { if (notificationView) resetAiRequests(); setShowOnlyFavorites(!showOnlyFavorites); }}
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
              onClick={() => profile.role === 'master' ? setIsSettingsModalOpen(true) : void loadData()}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium shrink-0 transition-colors shadow-2xs"
            >
              {profile.role === 'master' ? '설정 열기' : '다시 확인'}
            </button>
          </div>
        )}

        {/* Search Results Area */}
        <section className="flex-1 flex flex-col">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-blue-600">{isAiSearchMode ? '✨' : '🔍'}</span> {notificationView ? '알림에서 연 자료' : isAiSearchMode ? 'AI 검색 결과' : '검색 결과'}
              </h2>
            </div>

          </div>

          {notificationView && <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{notificationView.notification.info_title || '알림의 자료'}</p>
              <button type="button" onClick={handleGoHome} className="text-xs font-semibold text-blue-700 underline">전체 자료 보기</button>
            </div>
            {!notificationView.context && !notificationView.error && <p role="status" className="mt-2">해당 자료와 댓글을 불러오는 중...</p>}
            {notificationView.error && <p role="alert" className="mt-2 text-rose-700">{notificationView.error}</p>}
            {notificationView.context && <p className="mt-1 text-xs">알림의 댓글을 펼쳐 강조했습니다. 위쪽에서 글 내용과 첨부 이미지도 확인할 수 있습니다.</p>}
          </div>}

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
                  {aiSearchStatus === 'pending' ? '한주AI 연결 대기 중' : aiSearchStatus === 'web_search' ? '내부 근거가 없어 인터넷 자료를 찾는 중' : aiSearchStatus === 'web_analysis' ? '한주AI가 인터넷 자료를 분석 중' : '한주AI가 내부 자료를 분석 중'}
                  <span className="ml-2 text-xs font-medium text-violet-600">{aiSearchElapsedSeconds}초</span>
                </p>
                <p className="text-xs text-violet-600 mt-0.5">첫 검색은 준비하는 데 더 걸릴 수 있습니다. 완료되면 답변이 표시됩니다.</p>
              </div>
            </div>
          )}

          {isAiSearchMode && aiSearchResult && (
            <AIAnswerPanel key={aiSearchResult.query} result={aiSearchResult} onSave={handleSaveAiCorrection} />
          )}

          {isAiSearchMode && aiQuery && <div className="mb-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleWebSearch()} disabled={isWebSearching || (!webStarted.current && isAiSearching && ['web_search','web_analysis'].includes(aiSearchStatus))} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
              {isWebSearching ? webSearchStatus === 'pending' ? '한주AI 연결 대기 중...' : webSearchStatus === 'web_analysis' ? '인터넷 자료 분석 중...' : '인터넷 검색 중...' : webAnswer ? '인터넷에서 다시 확인' : aiSearchResult?.coverage === 'partial' ? '인터넷에서 보완 검색' : '인터넷에서 추가 확인'}
            </button>
            <span className="text-xs text-slate-500">내부 답변이 부족하면 인터넷 자료로 보완할 수 있습니다.</span>
          </div>}
          {webSearchError && <p role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{webSearchError}</p>}
          {isAiSearchMode && webAnswer && <>
            {webAnswer.message && <p role="status" className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">{webAnswer.message}</p>}
            {(webAnswer.summary || webAnswer.sources.length > 0) && <AIAnswerPanel key={`web-${aiQuery}-${webAnswer.summary}`} variant="web" result={{ query: aiQuery, summary: webAnswer.summary || webAnswer.message || '', results: [], synced_count: items.length, web: webAnswer }} onSave={handleSaveAiCorrection} />}
          </>}

          {/* Loading State */}
          {isLoading && !notificationView && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Loader2 size={36} className="text-blue-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">데이터를 불러오는 중입니다...</p>
              <p className="text-xs text-slate-400 mt-1">Supabase에서 실시간 동기화 중</p>
            </div>
          )}

          {/* Empty State */}
          {!notificationView && !isLoading && !isAiSearching && !isAiSearchMode && visibleItems.length === 0 && (
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
                      resetAiRequests();
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
          {(!isLoading || notificationView?.context) && visibleItems.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5">
              {visibleItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  notificationComment={notificationView?.context?.comment}
                  notificationThreadId={notificationView?.context?.threadId}
                  commentCount={commentCounts[item.id!] || 0}
                  onCommentCountChange={handleCommentCountChange}
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
      {isAccountAdminOpen && profile.role === 'master' && <AccountAdmin onClose={() => setIsAccountAdminOpen(false)} />}
      {isPasswordOpen && <AccountPassword onClose={() => setIsPasswordOpen(false)} />}
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
        locked
        isOpen={isSettingsModalOpen && profile.role === 'master'}
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
