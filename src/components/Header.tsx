import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Settings, HelpCircle, PlusCircle, RefreshCw, Layers, Download, Ellipsis } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenHelpModal: () => void;
  children: ReactNode;
}

export function Header({ isConnected, totalCount, filteredCount, isLoading, onRefresh,
  onOpenAddModal, onOpenSettingsModal, onOpenHelpModal, children }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const action = (callback: () => void) => { setOpen(false); callback(); };
  const itemClass = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-500';
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-xs">
      <h1 className="sr-only">HanSearch</h1>
      <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-3 sm:items-center sm:gap-3 sm:px-6">
        <div className="hidden shrink-0 items-center gap-2 text-blue-600 sm:flex" aria-hidden="true">
          <Layers size={22} /><span className="hidden text-base font-black tracking-tight text-slate-800 lg:inline">HanSearch</span>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        <div ref={root} className="relative shrink-0">
          <button ref={trigger} type="button" onClick={() => setOpen((value) => !value)} aria-label="관리 메뉴" title="관리 메뉴" aria-expanded={open} aria-controls={menuId}
            className="flex h-11 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-500"><Ellipsis size={23} /></button>
          {open && <nav id={menuId} aria-label="관리 메뉴 항목" className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="mb-1 border-b border-slate-100 px-3 py-3 text-xs text-slate-500">
              <p className={isConnected ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>{isConnected ? 'Supabase 연결됨' : 'Supabase 연결 필요'}</p>
              <p className="mt-1">전체 {totalCount}건 · 검색 결과 {filteredCount}건</p>
            </div>
            <button type="button" onClick={() => action(onRefresh)} disabled={isLoading} className={`${itemClass} disabled:opacity-50`}><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />새로고침</button>
            <button type="button" onClick={() => action(onOpenAddModal)} className={itemClass}><PlusCircle size={16} />데이터 추가</button>
            <button type="button" onClick={() => action(onOpenSettingsModal)} className={itemClass}><Settings size={16} />설정</button>
            <button type="button" onClick={() => action(onOpenHelpModal)} className={itemClass}><HelpCircle size={16} />도움말</button>
            <a href="/downloads/HanSearch.apk" download="HanSearch.apk" onClick={() => setOpen(false)} className={itemClass}><Download size={16} />앱 다운로드</a>
          </nav>}
        </div>
      </div>
    </header>
  );
}

