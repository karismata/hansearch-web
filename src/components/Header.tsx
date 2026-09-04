import React from 'react';
import { 
  Settings, 
  HelpCircle, 
  PlusCircle, 
  RefreshCw,
  Layers
} from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenAddModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenHelpModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  totalCount,
  filteredCount,
  isLoading,
  onRefresh,
  onOpenAddModal,
  onOpenSettingsModal,
  onOpenHelpModal,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-2 rounded-xl shadow-md flex items-center justify-center">
              <Layers size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                  HanSearch <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Web</span>
                </h1>
                {/* Connection status indicator */}
                <button
                  onClick={onOpenSettingsModal}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                    isConnected
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  }`}
                  title={isConnected ? 'Supabase 연동됨 (설정 변경)' : 'Supabase 설정 필요'}
                >
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {isConnected ? 'Supabase 연결됨' : '연결 필요'}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                총 <strong className="text-slate-800 font-semibold">{totalCount}</strong>건
                {filteredCount !== totalCount && (
                  <span> (검색 결과: <strong className="text-blue-600 font-semibold">{filteredCount}</strong>건)</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
            title="새로고침"
          >
            <RefreshCw size={17} className={isLoading ? 'animate-spin text-blue-600' : ''} />
          </button>

          {/* Help Button */}
          <button
            onClick={onOpenHelpModal}
            className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            title="도움말 및 단축키"
          >
            <HelpCircle size={15} />
            <span>도움말</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettingsModal}
            className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            title="Supabase DB 및 버킷 설정"
          >
            <Settings size={15} />
            <span>설정</span>
          </button>

          <div className="w-[1px] h-6 bg-slate-200 mx-0.5 hidden sm:block" />

          {/* Add Data (Primary Green Button) */}
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg transition-all flex items-center gap-1.5 shadow-sm hover:shadow cursor-pointer"
            title="새로운 데이터 추가 (Ctrl+N)"
          >
            <PlusCircle size={16} />
            <span>데이터 추가</span>
          </button>
        </div>
      </div>
    </header>
  );
};

