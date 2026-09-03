import React from 'react';
import { X, HelpCircle, Keyboard, Search, Image as ImageIcon, FileSpreadsheet, Star } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <HelpCircle size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">도움말 & 사용 팁</h2>
              <p className="text-xs text-slate-500">HanSearch Web 활용 가이드</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600">
          {/* Shortcuts */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
              <Keyboard size={16} className="text-blue-600" />
              키보드 단축키
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700">
              <li className="flex items-center justify-between">
                <span>검색창으로 포커스 이동</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono shadow-2xs font-bold text-slate-800">/</kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>모달 / 팝업 닫기</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono shadow-2xs font-bold text-slate-800">ESC</kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>이미지 뷰어 좌/우 탐색</span>
                <kbd className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono shadow-2xs font-bold text-slate-800">← / →</kbd>
              </li>
            </ul>
          </div>

          {/* Tips */}
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0 mt-0.5">
                <Search size={15} />
              </div>
              <div>
                <strong className="text-slate-800 block mb-0.5">검색 범위 및 하이라이트</strong>
                <p>
                  검색창에 입력한 키워드는 <strong>키워드2(제목)</strong>와 <strong>내용(본문)</strong>에서 동시에 실시간 검색되며, 일치하는 텍스트는 노란색으로 강조 표시됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 mt-0.5">
                <ImageIcon size={15} />
              </div>
              <div>
                <strong className="text-slate-800 block mb-0.5">캡처 이미지 즉시 붙여넣기 (Ctrl+V)</strong>
                <p>
                  [데이터 추가] 창을 열고 화면 캡처(윈도우 단축키: <kbd className="px-1 py-0.5 bg-slate-100 border rounded">Win+Shift+S</kbd>) 후 바로 <kbd className="px-1 py-0.5 bg-slate-100 border rounded">Ctrl+V</kbd>를 누르면 자동으로 이미지가 첨부됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0 mt-0.5">
                <Star size={15} />
              </div>
              <div>
                <strong className="text-slate-800 block mb-0.5">즐겨찾기 기능</strong>
                <p>
                  카드 좌측 상단의 별표(☆)를 클릭하면 즐겨찾기에 등록되며, 상단 필터에서 즐겨찾기 항목만 모아볼 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg shrink-0 mt-0.5">
                <FileSpreadsheet size={15} />
              </div>
              <div>
                <strong className="text-slate-800 block mb-0.5">엑셀 일괄 등록 및 백업</strong>
                <p>
                  대량의 데이터를 엑셀 파일로 한 번에 업로드할 수 있으며, 현재 조회된 결과를 언제든 엑셀 파일로 내려받아 백업할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
