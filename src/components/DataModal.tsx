import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Plus, Image as ImageIcon, Trash2, Link as LinkIcon, Loader2 } from 'lucide-react';
import type { InfoItem } from '../types';

import { uploadImageToStorage } from '../lib/supabase';
import { parseImageUrls } from '../utils/helpers';

interface DataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<InfoItem, 'id' | 'created_at'>) => Promise<void>;
  editingItem?: InfoItem | null;
  categoryList: string[];
}

export const DataModal: React.FC<DataModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  categoryList,
}) => {
  const [category, setCategory] = useState('공통');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingItem) {
      const isKnown = categoryList.includes(editingItem.키워드);
      if (isKnown) {
        setCategory(editingItem.키워드 || '공통');
        setIsCustomCategory(false);
        setCustomCategory('');
      } else {
        setCategory('__custom__');
        setIsCustomCategory(true);
        setCustomCategory(editingItem.키워드 || '');
      }
      setTitle(editingItem.키워드2 || '');
      setContent(editingItem.내용 || '');
      setImageUrls(parseImageUrls(editingItem.이미지들));
    } else {
      setCategory(categoryList[0] || '공통');
      setIsCustomCategory(false);
      setCustomCategory('');
      setTitle('');
      setContent('');
      setImageUrls([]);
    }
    setErrorMsg('');
  }, [editingItem, isOpen, categoryList]);

  // Handle Clipboard Paste (Ctrl+V) for instant image upload
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await handleFileUpload(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setErrorMsg('');
    try {
      const uploadedUrl = await uploadImageToStorage(file);
      setImageUrls((prev) => [...prev, uploadedUrl]);
    } catch (err: any) {
      console.warn('Storage upload error, converting to base64 fallback:', err);
      // Fallback: Read as base64 data URL if storage upload failed (e.g. no bucket or permission)
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setImageUrls((prev) => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
      setErrorMsg(`스토리지 업로드 경고 (${err.message}) - 로컬 미리보기로 첨부되었습니다.`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await handleFileUpload(files[i]);
    }
    e.target.value = '';
  };

  const handleAddManualUrl = () => {
    const trimmed = manualUrlInput.trim();
    if (!trimmed) return;
    setImageUrls((prev) => [...prev, trimmed]);
    setManualUrlInput('');
    setShowManualUrl(false);
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      setErrorMsg('카테고리를 입력해주세요.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('제목(키워드2)을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const imagePayload = imageUrls.length > 0 ? imageUrls.join('\n') : '';
      await onSave({
        키워드: finalCategory,
        키워드2: title.trim(),
        내용: content.trim(),
        이미지들: imagePayload || null,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Plus size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {editingItem ? '데이터 수정' : '새 데이터 추가'}
              </h2>
              <p className="text-xs text-slate-500">
                키워드(카테고리), 키워드2(제목), 내용 및 이미지를 입력하세요.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Category (키워드) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              카테고리 (키워드) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={isCustomCategory ? '__custom__' : category}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomCategory(true);
                  } else {
                    setIsCustomCategory(false);
                    setCategory(e.target.value);
                  }
                }}
                className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {categoryList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__custom__">+ 새 카테고리 직접 입력</option>
              </select>

              {isCustomCategory && (
                <input
                  type="text"
                  placeholder="새 카테고리명 입력 (예: 키오스크, 포스)"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-emerald-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* Title (키워드2) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              제목 / 소분류 (키워드2) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="예: 씨큐, 이모더 담당자 연락처 / 삼성키오스크 화면 안나올 때"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {/* Content (내용) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              본문 내용 (내용)
            </label>
            <textarea
              rows={6}
              placeholder="상세 설명, 조치 방법, 담당자 번호 등을 입력하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono leading-relaxed"
            />
          </div>

          {/* Image Upload & Clipboard Paste Zone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <ImageIcon size={14} className="text-blue-500" />
                이미지 첨부 ({imageUrls.length}개)
              </label>
              <button
                type="button"
                onClick={() => setShowManualUrl(!showManualUrl)}
                className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
              >
                <LinkIcon size={12} />
                {showManualUrl ? 'URL 입력 닫기' : 'URL 직접 입력'}
              </button>
            </div>

            {/* Direct URL Input */}
            {showManualUrl && (
              <div className="flex items-center gap-2 mb-2 p-2.5 bg-blue-50/50 rounded-xl border border-blue-100">
                <input
                  type="url"
                  placeholder="https://example.com/image.png"
                  value={manualUrlInput}
                  onChange={(e) => setManualUrlInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddManualUrl}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
            )}

            {/* Upload Drag & Drop & Paste Area */}
            <label className="relative flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-xl cursor-pointer transition-colors text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium py-2">
                  <Loader2 size={18} className="animate-spin" />
                  <span>스토리지에 이미지 업로드 중...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload size={22} className="mx-auto text-slate-400" />
                  <p className="text-xs text-slate-600">
                    클릭하여 이미지 파일 선택 또는 드래그 앤 드롭
                  </p>
                  <p className="text-[11px] text-emerald-600 font-medium">
                    💡 캡처 후 이 창에서 바로 <kbd className="px-1 py-0.5 bg-slate-200 rounded text-slate-800">Ctrl + V</kbd> 붙여넣기도 가능합니다!
                  </p>
                </div>
              )}
            </label>

            {/* Uploaded Images Preview List */}
            {imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative group/thumb rounded-lg overflow-hidden border border-slate-200 shadow-xs">
                    <img
                      src={url}
                      alt={`Attached ${idx + 1}`}
                      className="w-20 h-20 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-rose-600/90 text-white rounded-full opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-sm hover:bg-rose-700"
                      title="이미지 삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Submit buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : (
                <span>{editingItem ? '수정 완료' : '등록하기'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
