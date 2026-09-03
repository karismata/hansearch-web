import React, { useState } from 'react';
import { Star, Edit3, Trash2, Copy, Check, Image as ImageIcon } from 'lucide-react';
import type { InfoItem } from '../types';

import { HighlightText } from './HighlightText';
import { formatDate, parseImageUrls, copyToClipboard, normalizeContentText, parseCategories } from '../utils/helpers';

interface ItemCardProps {
  item: InfoItem;
  searchQuery: string;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  onEdit: (item: InfoItem) => void;
  onDelete: (id: number) => void;
  onOpenImage: (images: string[], index: number) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  searchQuery,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDelete,
  onOpenImage,
}) => {
  const [copied, setCopied] = useState(false);
  const images = parseImageUrls(item.이미지들);
  const categories = parseCategories(item.키워드);

  const handleCopyContent = async () => {
    const textToCopy = normalizeContentText(item.내용);
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <article className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 p-5 group flex flex-col justify-between">
      <div>
        {/* Header: Favorite star, Category Badges, Title */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-start gap-2 flex-1">
            {/* Favorite Star Button */}
            <button
              onClick={() => item.id && onToggleFavorite(item.id)}
              className={`p-0.5 rounded transition-transform active:scale-125 focus:outline-none mt-0.5 shrink-0 ${
                isFavorite
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-amber-400'
              }`}
              title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              <Star
                size={18}
                className={isFavorite ? 'fill-amber-400 stroke-amber-500' : 'stroke-[1.8]'}
              />
            </button>

            {/* Category Badges & Title */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80"
                  >
                    {cat}
                  </span>
                ))}
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                <HighlightText
                  text={item.키워드2 || '(제목 없음)'}
                  query={searchQuery}
                  className="text-slate-900 font-bold"
                />
              </h2>
            </div>
          </div>


          {/* Copy content button */}
          <button
            onClick={handleCopyContent}
            className={`px-2 py-1 text-xs rounded-md border flex items-center gap-1 transition-all ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
            title="본문 내용 전체 복사"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald-600 stroke-[2.5]" />
                <span className="text-[11px] font-medium">복사됨!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span className="text-[11px] font-medium">복사</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words pl-6 mb-4 font-normal bg-slate-50/50 p-3 rounded-lg border border-slate-100">
          <HighlightText text={item.내용 || ''} query={searchQuery} />
        </div>

        {/* Images Grid / Thumbnail Preview */}
        {images.length > 0 && (
          <div className="pl-6 mb-4">
            <div className="flex flex-wrap gap-2.5">
              {images.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenImage(images, idx)}
                  className="relative group/img cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-100 hover:border-blue-400 transition-all shadow-xs"
                >
                  <img
                    src={imgUrl}
                    alt={`Attachment ${idx + 1}`}
                    loading="lazy"
                    className="max-h-60 sm:max-h-80 w-auto object-cover rounded-md group-hover/img:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      // Fallback for broken image link
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover/img:opacity-100 bg-black/75 text-white text-[11px] px-2 py-1 rounded-full font-medium transition-opacity flex items-center gap-1 backdrop-blur-xs">
                      <ImageIcon size={12} /> 확대 보기
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Meta & Actions */}
      <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 pl-6">
        <div className="flex items-center gap-2 font-medium">
          <button
            onClick={() => onEdit(item)}
            className="text-slate-600 hover:text-blue-600 hover:underline flex items-center gap-1 transition-colors"
          >
            <Edit3 size={13} />
            <span>수정</span>
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => item.id && onDelete(item.id)}
            className="text-slate-600 hover:text-rose-600 hover:underline flex items-center gap-1 transition-colors"
          >
            <Trash2 size={13} />
            <span>삭제</span>
          </button>
        </div>

        <div className="text-slate-400 font-mono text-[11px]">
          {item.created_at && (
            <span>생성: {formatDate(item.created_at)}</span>
          )}
        </div>
      </div>
    </article>
  );
};
