import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import type { InfoItem } from '../types';


interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredItems: InfoItem[];
  totalCount: number;
  onConfirmDelete: (ids: number[]) => Promise<void>;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  filteredItems,
  totalCount,
  onConfirmDelete,
}) => {
  const [deleteMode, setDeleteMode] = useState<'filtered' | 'all'>('filtered');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const targetCount = deleteMode === 'filtered' ? filteredItems.length : totalCount;
  const isConfirmed = confirmText.trim() === '삭제';

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    setErrorMsg('');

    try {
      const idsToDelete = deleteMode === 'filtered' 
        ? filteredItems.map((item) => item.id!).filter(Boolean)
        : filteredItems.map((item) => item.id!).filter(Boolean); // If 'all', App handles or passes all ids

      await onConfirmDelete(idsToDelete);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <AlertTriangle size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">info 데이터 대량 삭제</h2>
              <p className="text-xs text-slate-500">
                선택한 데이터를 DB에서 영구 삭제합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            ⚠️ <strong>주의:</strong> 삭제된 데이터는 복구할 수 없습니다. 삭제 전 필요시 상단의 <strong>[엑셀 다운로드]</strong>로 백업을 권장합니다.
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-100 text-rose-800 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Delete Scope Selection */}
          <div className="space-y-2 text-xs">
            <label className="block font-bold text-slate-700">삭제 대상 선택:</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="delScope"
                  checked={deleteMode === 'filtered'}
                  onChange={() => setDeleteMode('filtered')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-semibold text-slate-800">현재 검색/필터된 데이터만 삭제</span>
                  <span className="text-slate-500 ml-1">({filteredItems.length}건)</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="delScope"
                  checked={deleteMode === 'all'}
                  onChange={() => setDeleteMode('all')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="font-semibold text-rose-700">전체 데이터 모두 삭제</span>
                  <span className="text-slate-500 ml-1">(총 {totalCount}건)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Safety Confirm Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              확인을 위해 아래 입력창에 <strong className="text-rose-600">삭제</strong> 라고 입력하세요:
            </label>
            <input
              type="text"
              placeholder="삭제"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 text-sm text-center font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting || targetCount === 0}
            className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            {isDeleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>삭제 중...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>{targetCount}건 영구 삭제</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
