import { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
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
  bulkDeleteItems, 
  bulkInsertItems
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
import { ExcelModal } from './components/ExcelModal';
import { SettingsModal } from './components/SettingsModal';
import { BulkDeleteModal } from './components/BulkDeleteModal';
import { HelpModal } from './components/HelpModal';
import { ImageLightbox } from './components/ImageLightbox';
import { AlertTriangle, Plus, SearchX, Loader2 } from 'lucide-react';


export function App() {
  // Config & Connection State
  const [config, setConfig] = useState<SupabaseConfig>(getDefaultConfig());
  const [isConnected, setIsConnected] = useState<boolean>(false);
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

  // Modal States
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InfoItem | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
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

    if (!targetConfig.url || !targetConfig.anonKey) {
      setIsConnected(false);
      setIsLoading(false);
      setLoadError('Supabase 연결 정보(URL, Anon Key)를 설정해주세요.');
      setIsSettingsModalOpen(true); // Open settings modal automatically if not configured
      return;
    }

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

  // Favorites Management
  const handleToggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id];
      saveStoredFavorites(next);
      return next;
    });
  };

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
    setActiveSearch(searchInput.trim());
  };

  // Quick Tag Click
  const handleSelectTag = (tag: string) => {
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
    const query = activeSearch.toLowerCase().replace(/^#/, '');

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
        if (showOnlyFavorites && !favorites.includes(item.id!)) {
          return false;
        }

        // Keyword Search (키워드2 and 내용)
        if (query) {
          const title = (item.키워드2 || '').toLowerCase();
          const content = (item.내용 || '').toLowerCase();
          const keyword = (item.키워드 || '').toLowerCase();
          return title.includes(query) || content.includes(query) || keyword.includes(query);
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
  }, [items, activeSearch, selectedCategory, showOnlyFavorites, favorites, sortOption]);

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

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('이 항목을 정말 삭제하시겠습니까?')) return;
    try {
      await deleteItem(id, config);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setFavorites((prev) => prev.filter((favId) => favId !== id));
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  const handleBulkDelete = async (ids: number[]) => {
    await bulkDeleteItems(ids, config);
    setItems((prev) => prev.filter((item) => !ids.includes(item.id!)));
    setFavorites((prev) => prev.filter((favId) => !ids.includes(favId)));
  };

  const handleBulkInsert = async (newItems: Array<Omit<InfoItem, 'id' | 'created_at'>>) => {
    const count = await bulkInsertItems(newItems, config);
    await loadData();
    return count;
  };

  // Excel Export
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const exportRows = filteredItems.map((item) => ({
      ID: item.id,
      키워드: item.키워드,
      키워드2: item.키워드2,
      내용: item.내용,
      이미지들: item.이미지들 || '',
      등록일시: item.created_at,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'info_검색결과');
    
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `HanSearch_Export_${today}.xlsx`);
  };

  // Open Lightbox
  const handleOpenImage = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <Header
        isConnected={isConnected}
        totalCount={items.length}
        filteredCount={filteredItems.length}
        isLoading={isLoading}
        onRefresh={() => loadData()}
        onOpenAddModal={() => {
          setEditingItem(null);
          setIsDataModalOpen(true);
        }}
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        onExportExcel={handleExportExcel}
        onOpenBulkDeleteModal={() => setIsBulkDeleteModalOpen(true)}
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
            }}
            onSearchSubmit={handleSearchSubmit}
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
                <span className="text-blue-600">🔍</span> 검색 결과
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-full">
                {filteredItems.length}건
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

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Loader2 size={36} className="text-blue-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">데이터를 불러오는 중입니다...</p>
              <p className="text-xs text-slate-400 mt-1">Supabase에서 실시간 동기화 중</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-center">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl mb-3">
                <SearchX size={40} />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {activeSearch ? `"${activeSearch}" 검색 결과가 없습니다` : '등록된 데이터가 없습니다'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                {activeSearch
                  ? '다른 키워드로 검색하거나 카테고리 필터를 변경해 보세요.'
                  : '상단의 [데이터 추가] 또는 [엑셀 업로드] 버튼을 눌러 새 가이드를 등록해 보세요.'}
              </p>
              <div className="flex items-center gap-2">
                {activeSearch ? (
                  <button
                    onClick={() => {
                      setSearchInput('');
                      setActiveSearch('');
                      setSelectedCategory('');
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
          {!isLoading && filteredItems.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  searchQuery={activeSearch}
                  isFavorite={favorites.includes(item.id!)}
                  onToggleFavorite={handleToggleFavorite}
                  onEdit={(target) => {
                    setEditingItem(target);
                    setIsDataModalOpen(true);
                  }}
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

      <ExcelModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onBulkInsert={handleBulkInsert}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />

      <BulkDeleteModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        filteredItems={filteredItems}
        totalCount={items.length}
        onConfirmDelete={handleBulkDelete}
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
