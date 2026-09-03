import React, { useState } from 'react';
import { Hash, Plus, X, RotateCcw } from 'lucide-react';
import { DEFAULT_TAGS } from '../utils/helpers';

interface QuickTagsProps {
  tags: string[];
  activeSearch: string;
  onSelectTag: (tag: string) => void;
  onUpdateTags: (tags: string[]) => void;
}

export const QuickTags: React.FC<QuickTagsProps> = ({
  tags,
  activeSearch,
  onSelectTag,
  onUpdateTags,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    let clean = newTagInput.trim();
    if (!clean) return;
    if (!clean.startsWith('#')) clean = `#${clean}`;
    if (!tags.includes(clean)) {
      onUpdateTags([...tags, clean]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleResetTags = () => {
    if (window.confirm('자주 찾는 검색어 태그를 기본값으로 초기화하시겠습니까?')) {
      onUpdateTags(DEFAULT_TAGS);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1 text-sm">
      <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
        <Hash size={14} className="text-blue-500" /> 자주 찾는 검색어:
      </span>

      {tags.map((tag) => {
        const keyword = tag.replace(/^#/, '');
        const isSelected = activeSearch === keyword || activeSearch === tag;

        return (
          <div
            key={tag}
            className="group relative inline-flex items-center"
          >
            <button
              onClick={() => onSelectTag(isSelected ? '' : keyword)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 flex items-center gap-1 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                  : 'bg-blue-50/80 text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-200/70'
              }`}
            >
              <span>{tag}</span>
            </button>

            {isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
                className="ml-0.5 p-0.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"
                title="태그 삭제"
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}

      {isEditing ? (
        <div className="flex items-center gap-1">
          <form onSubmit={handleAddTag} className="inline-flex">
            <input
              type="text"
              placeholder="#새태그"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              className="px-2 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-20"
              autoFocus
            />
          </form>
          <button
            onClick={handleResetTags}
            className="p-1 text-slate-400 hover:text-slate-600"
            title="기본값 복원"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="text-xs text-slate-500 hover:text-slate-800 underline px-1"
          >
            완료
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 rounded transition-colors"
          title="태그 편집 (추가/삭제)"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
};
