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

  const searchTerms = query
    .split(/\s+and\s+/i)
    .map((term) => term.trim().replace(/^#/, ''))
    .filter(Boolean);
  if (searchTerms.length === 0) {
    return <span className={`whitespace-pre-wrap ${className}`}>{normalized}</span>;
  }

  try {
    // Escape special regex characters and highlight every AND search term.
    const escapedTerms = searchTerms
      .sort((a, b) => b.length - a.length)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    const parts = normalized.split(regex);

    return (
      <span className={`whitespace-pre-wrap ${className}`}>
        {parts.map((part, i) =>
          i % 2 === 1 ? (
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

