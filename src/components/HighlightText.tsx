import React from 'react';
import { normalizeContentText } from '../utils/helpers';

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({ text, query, className = '' }) => {
  const normalized = normalizeContentText(text);

  if (!query || !query.trim() || !normalized) {
    return <span className={`whitespace-pre-wrap ${className}`}>{normalized}</span>;
  }

  const cleanQuery = query.trim().replace(/^#/, ''); // Remove # if tag search
  if (!cleanQuery) {
    return <span className={`whitespace-pre-wrap ${className}`}>{normalized}</span>;
  }

  try {
    // Escape special regex characters
    const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = normalized.split(regex);

    return (
      <span className={`whitespace-pre-wrap ${className}`}>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="search-highlight">
              {part}
            </mark>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </span>
    );
  } catch {
    return <span className={`whitespace-pre-wrap ${className}`}>{normalized}</span>;
  }
};

