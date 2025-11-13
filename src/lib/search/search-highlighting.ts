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
 * Find text node and offset for a given character position in an element
 */
function findTextNodeAndOffset(element: HTMLElement, targetOffset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentOffset = 0;
  let node: Text | null = null;

  while ((node = walker.nextNode() as Text)) {
    const nodeLength = node.textContent?.length || 0;
    if (currentOffset + nodeLength >= targetOffset) {
      return {
        node,
        offset: targetOffset - currentOffset
      };
    }
    currentOffset += nodeLength;
  }

  return null;
}

/**
 * Highlight a specific match in a line using Range API for precise positioning
 */
function highlightMatchInLine(match: SearchMatch, matchIndex: number): void {
  if (!editor) return;

  const searchState = getSearchState();
  const isCurrentMatch = matchIndex === searchState.currentMatchIndex;

  // Find the line element
  const lineElement = editor.querySelector(`.editor-line[data-line="${match.line - 1}"]`) as HTMLElement;
  if (!lineElement) return;

  // Get the actual text content of the line (what's rendered)
  const lineTextContent = lineElement.textContent || '';

  // The match column is 1-indexed, convert to 0-indexed
  const startOffset = match.column - 1;
  const endOffset = startOffset + match.length;

  // Verify the match is within bounds
  if (startOffset < 0 || endOffset > lineTextContent.length) {
    return;
  }

  try {
    // Find the text nodes and offsets for the match
    const startPos = findTextNodeAndOffset(lineElement, startOffset);
    const endPos = findTextNodeAndOffset(lineElement, endOffset);

    if (!startPos || !endPos) {
      return;
    }

    // Create a range for the matched text
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    // Get the bounding rectangle of the matched text
    const rects = range.getClientRects();
    if (rects.length === 0) return;

    const editorRect = editor.getBoundingClientRect();
    const editorScrollTop = editor.scrollTop || 0;
    const editorScrollLeft = editor.scrollLeft || 0;

    // Create highlights for each rect (in case text wraps)
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];

      // Create highlight overlay
      const highlight = document.createElement('div');
      highlight.className = isCurrentMatch ? 'search-highlight-current' : 'search-highlight';
      highlight.style.position = 'absolute';
      highlight.style.left = `${rect.left - editorRect.left + editorScrollLeft}px`;
      highlight.style.top = `${rect.top - editorRect.top + editorScrollTop}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.backgroundColor = isCurrentMatch ? 'rgba(255, 165, 0, 0.5)' : 'rgba(255, 255, 0, 0.3)';
      highlight.style.pointerEvents = 'none';
      highlight.style.borderRadius = '2px';
      highlight.style.zIndex = '1';
      highlight.style.boxSizing = 'border-box';

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
        highlightContainer.style.overflow = 'visible';
        editor.style.position = 'relative';
        editor.insertBefore(highlightContainer, editor.firstChild);
      }

      highlightContainer.appendChild(highlight);
      highlightElements.push(highlight);
    }
  } catch (error) {
    console.error('Error highlighting match:', error);
  }
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
