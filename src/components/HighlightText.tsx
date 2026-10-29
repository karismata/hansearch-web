import React from 'react';
import { normalizeContentText } from '../utils/helpers';

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
const TRAILING_URL_PUNCTUATION = /[.,!?;:)}\]]+$/;

export const HighlightText: React.FC<HighlightTextProps> = ({ text, query, className = '' }) => {
  const normalized = normalizeContentText(text);
  const searchTerms = query
    .split(/\s+/)
    .map((term) => term.trim().replace(/^#/, ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let highlightRegex: RegExp | null = null;
  if (searchTerms.length > 0) {
    try {
      const escapedTerms = searchTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      highlightRegex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    } catch {
      highlightRegex = null;
    }
  }

  const renderHighlightedText = (value: string, keyPrefix: string): React.ReactNode => {
    if (!highlightRegex) return value;
    const parts = value.split(highlightRegex);
    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <mark key={`${keyPrefix}-${index}`} className="search-highlight">{part}</mark>
      ) : (
        <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>
      )
    );
  };

  const renderContent = () => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    let linkIndex = 0;

    for (const match of normalized.matchAll(URL_PATTERN)) {
      const rawUrl = match[0];
      const start = match.index ?? 0;
      const trailingPunctuation = rawUrl.match(TRAILING_URL_PUNCTUATION)?.[0] ?? '';
      const visibleUrl = trailingPunctuation
        ? rawUrl.slice(0, -trailingPunctuation.length)
        : rawUrl;

      if (!visibleUrl) continue;
      if (start > cursor) {
        nodes.push(renderHighlightedText(normalized.slice(cursor, start), `text-${linkIndex}`));
      }

      const href = visibleUrl.toLowerCase().startsWith('www.') ? `https://${visibleUrl}` : visibleUrl;
      const isAndroidApp = typeof navigator !== 'undefined' && navigator.userAgent.includes('HanSearchAndroidApp');
      nodes.push(
        <a
          key={`url-${linkIndex}`}
          href={href}
          target={isAndroidApp ? '_self' : '_blank'}
          rel="noopener noreferrer"
          className="text-blue-700 underline underline-offset-2 break-all hover:text-blue-900"
          onClick={(event) => event.stopPropagation()}
        >
          {renderHighlightedText(visibleUrl, `url-text-${linkIndex}`)}
        </a>
      );
      if (trailingPunctuation) nodes.push(trailingPunctuation);
      cursor = start + rawUrl.length;
      linkIndex += 1;
    }

    if (cursor < normalized.length) {
      nodes.push(renderHighlightedText(normalized.slice(cursor), `text-${linkIndex}`));
    }

    return nodes.length > 0 ? nodes : renderHighlightedText(normalized, 'text');
  };

  return <span className={`whitespace-pre-wrap ${className}`}>{renderContent()}</span>;
};
