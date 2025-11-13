/**
 * Search highlighting functionality
 * Highlights search matches in the editor
 */

import { getSearchState } from './search-state';
import type { SearchMatch } from './search-state';
import { editor } from '../core/dom';

// Store highlight elements for cleanup
let highlightElements: HTMLElement[] = [];

/**
 * Apply highlights to search matches in the editor
 */
export function highlightMatches(matches: SearchMatch[]): void {
  // Clear existing highlights
  clearHighlights();

  if (!editor || matches.length === 0) {
    return;
  }

  matches.forEach((match, index) => {
    highlightMatchInLine(match, index);
  });
}

/**
 * Highlight a specific match in a line
 */
function highlightMatchInLine(match: SearchMatch, matchIndex: number): void {
  if (!editor) return;

  const searchState = getSearchState();
  const isCurrentMatch = matchIndex === searchState.currentMatchIndex;

  // Find the line element
  const lineElement = editor.querySelector(`.editor-line[data-line="${match.line - 1}"]`) as HTMLElement;
  if (!lineElement) return;

  // Get the raw text of the line
  const lineText = lineElement.getAttribute('data-raw') || '';
  if (!lineText) return;

  // Find the match position in the line
  const columnIndex = match.column - 1;

  // Create a highlight span that we'll insert into the line
  const beforeText = lineText.substring(0, columnIndex);
  const matchText = lineText.substring(columnIndex, columnIndex + match.length);
  const afterText = lineText.substring(columnIndex + match.length);

  // Create highlight element overlay
  const lineRect = lineElement.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();

  // Create a temporary span to measure text width
  const tempSpan = document.createElement('span');
  tempSpan.style.cssText = window.getComputedStyle(lineElement).cssText;
  tempSpan.style.position = 'absolute';
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.whiteSpace = 'pre';
  tempSpan.textContent = beforeText;
  document.body.appendChild(tempSpan);

  const leftOffset = tempSpan.offsetWidth;

  tempSpan.textContent = matchText;
  const matchWidth = tempSpan.offsetWidth;

  document.body.removeChild(tempSpan);

  // Create highlight overlay
  const highlight = document.createElement('div');
  highlight.className = isCurrentMatch ? 'search-highlight-current' : 'search-highlight';
  highlight.style.position = 'absolute';
  highlight.style.left = `${lineRect.left - editorRect.left + leftOffset}px`;
  highlight.style.top = `${lineRect.top - editorRect.top}px`;
  highlight.style.width = `${matchWidth}px`;
  highlight.style.height = `${lineRect.height}px`;
  highlight.style.backgroundColor = isCurrentMatch ? 'rgba(255, 165, 0, 0.5)' : 'rgba(255, 255, 0, 0.3)';
  highlight.style.pointerEvents = 'none';
  highlight.style.borderRadius = '2px';
  highlight.style.zIndex = '1';
  highlight.style.transition = 'background-color 0.2s';

  // Add to highlight container
  let highlightContainer = editor.querySelector('.search-highlights-container') as HTMLElement;
  if (!highlightContainer) {
    highlightContainer = document.createElement('div');
    highlightContainer.className = 'search-highlights-container';
    highlightContainer.style.position = 'absolute';
    highlightContainer.style.top = '0';
    highlightContainer.style.left = '0';
    highlightContainer.style.width = '100%';
    highlightContainer.style.height = '100%';
    highlightContainer.style.pointerEvents = 'none';
    highlightContainer.style.zIndex = '1';
    editor.style.position = 'relative';
    editor.insertBefore(highlightContainer, editor.firstChild);
  }

  highlightContainer.appendChild(highlight);
  highlightElements.push(highlight);
}

/**
 * Clear all search highlights
 */
export function clearHighlights(): void {
  if (!editor) return;

  const highlightContainer = editor.querySelector('.search-highlights-container');
  if (highlightContainer) {
    highlightContainer.remove();
  }

  highlightElements = [];
}

/**
 * Scroll to a specific match
 */
export function scrollToMatch(match: SearchMatch): void {
  if (!editor) return;

  // Find the line element
  const lineElement = editor.querySelector(`.editor-line[data-line="${match.line - 1}"]`) as HTMLElement;
  if (!lineElement) return;

  // Scroll the line into view
  lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Focus the editor
  editor.focus();
}

/**
 * Update highlight for current match (when navigating)
 */
export function updateCurrentMatchHighlight(): void {
  const searchState = getSearchState();
  if (searchState.currentFileMatches.length === 0) return;

  // Re-highlight all matches to update the current match styling
  highlightMatches(searchState.currentFileMatches);

  // Scroll to the current match
  const currentMatch = searchState.currentFileMatches[searchState.currentMatchIndex];
  if (currentMatch) {
    scrollToMatch(currentMatch);
  }
}
