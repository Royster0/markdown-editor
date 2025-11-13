/**
 * Current file search functionality
 * Handles searching and replacing within the currently open file
 */

import { invoke } from '@tauri-apps/api/core';
import type { SearchMatch, SearchOptions } from './search-state';
import { getSearchState, setCurrentFileMatches, nextMatch, previousMatch } from './search-state';
import { highlightMatches, scrollToMatch, clearHighlights } from './search-highlighting';
import { state } from '../core/state';
import { editor } from '../core/dom';
import { renderAllLines } from '../editor/rendering';

/**
 * Get the rendered text content from the editor (line by line)
 */
function getRenderedContent(): string {
  if (!editor) return '';

  const lines: string[] = [];
  const lineElements = editor.querySelectorAll('.editor-line');

  lineElements.forEach((lineElement) => {
    lines.push(lineElement.textContent || '');
  });

  return lines.join('\n');
}

/**
 * Update state.content from the editor's data-raw attributes
 */
function updateStateFromEditor(): void {
  if (!editor) return;

  const lines: string[] = [];
  const lineElements = editor.querySelectorAll('.editor-line');

  lineElements.forEach((lineElement) => {
    const rawText = lineElement.getAttribute('data-raw') || '';
    lines.push(rawText);
  });

  state.content = lines.join('\n');
  state.isDirty = true;
}

/**
 * Search in the current file content (rendered text)
 */
export async function searchInCurrentFile(query: string, options: SearchOptions): Promise<void> {
  if (!query || !editor) {
    setCurrentFileMatches([]);
    clearHighlights();
    return;
  }

  try {
    // Get the rendered text content from the editor
    const renderedContent = getRenderedContent();

    // Search in the rendered content
    const matches = await invoke<SearchMatch[]>('search_in_content', {
      query,
      content: renderedContent,
      options,
    });

    setCurrentFileMatches(matches);
    highlightMatches(matches);

    // Scroll to first match if any (don't focus to avoid cursor issues)
    if (matches.length > 0) {
      scrollToMatch(matches[0], false);
    }
  } catch (error) {
    console.error('Search failed:', error);
    setCurrentFileMatches([]);
    clearHighlights();
  }
}

/**
 * Navigate to the next match in the current file
 */
export function goToNextMatch(): void {
  const searchState = getSearchState();
  console.log('goToNextMatch called, matches:', searchState.currentFileMatches.length, 'current index before:', searchState.currentMatchIndex);

  if (searchState.currentFileMatches.length === 0) return;

  nextMatch();

  // Get fresh state after update
  const updatedState = getSearchState();
  console.log('After nextMatch, current index:', updatedState.currentMatchIndex);

  // Re-highlight all matches with updated current match
  highlightMatches(updatedState.currentFileMatches);

  const currentMatch = updatedState.currentFileMatches[updatedState.currentMatchIndex];
  if (currentMatch) {
    scrollToMatch(currentMatch, false);
  }
}

/**
 * Navigate to the previous match in the current file
 */
export function goToPreviousMatch(): void {
  const searchState = getSearchState();
  console.log('goToPreviousMatch called, matches:', searchState.currentFileMatches.length, 'current index before:', searchState.currentMatchIndex);

  if (searchState.currentFileMatches.length === 0) return;

  previousMatch();

  // Get fresh state after update
  const updatedState = getSearchState();
  console.log('After previousMatch, current index:', updatedState.currentMatchIndex);

  // Re-highlight all matches with updated current match
  highlightMatches(updatedState.currentFileMatches);

  const currentMatch = updatedState.currentFileMatches[updatedState.currentMatchIndex];
  if (currentMatch) {
    scrollToMatch(currentMatch, false);
  }
}

/**
 * Replace the current match in the rendered content
 */
export async function replaceCurrentMatch(): Promise<void> {
  const searchState = getSearchState();
  if (searchState.currentFileMatches.length === 0 || !editor) return;

  const currentMatch = searchState.currentFileMatches[searchState.currentMatchIndex];
  if (!currentMatch) return;

  try {
    // Find the line element
    const lineElement = editor.querySelector(`.editor-line[data-line="${currentMatch.line - 1}"]`) as HTMLElement;
    if (!lineElement) return;

    // Get the raw text of the line
    const rawText = lineElement.getAttribute('data-raw') || '';
    const renderedText = lineElement.textContent || '';

    // Find the match in the rendered text
    const renderedStartPos = currentMatch.column - 1;
    const renderedEndPos = renderedStartPos + currentMatch.length;

    // We need to find the corresponding position in the raw markdown
    // For now, we'll try to find the match text in the raw content
    const matchText = renderedText.substring(renderedStartPos, renderedEndPos);

    // Try to find this text in the raw content
    const rawMatchIndex = rawText.indexOf(matchText);

    if (rawMatchIndex !== -1) {
      // Found exact match in raw text - simple case
      const newRawText =
        rawText.substring(0, rawMatchIndex) +
        searchState.replaceText +
        rawText.substring(rawMatchIndex + matchText.length);

      // Update the line's data-raw attribute
      lineElement.setAttribute('data-raw', newRawText);

      // Update state.content from all lines
      updateStateFromEditor();

      // Re-render the line
      await renderAllLines(null, state.editMode);

      // Re-search to update match positions
      setTimeout(async () => {
        await searchInCurrentFile(searchState.query, searchState.options);
      }, 100);
    } else {
      // Couldn't find exact match - this happens when markdown formatting changes the text
      // In this case, we'll do a more sophisticated search
      console.warn('Could not find exact match in raw text, using fallback method');

      // Fallback: use regex to replace in the raw text
      const result = await invoke<{ newContent: string; replacedCount: number }>('replace_in_content', {
        query: searchState.query,
        replacement: searchState.replaceText,
        content: rawText,
        options: searchState.options,
      });

      if (result.replacedCount > 0) {
        // Update just this line
        lineElement.setAttribute('data-raw', result.newContent);

        // Update state.content from all lines
        updateStateFromEditor();

        // Re-render the line
        await renderAllLines(null, state.editMode);

        // Re-search to update match positions
        setTimeout(async () => {
          await searchInCurrentFile(searchState.query, searchState.options);
        }, 100);
      }
    }
  } catch (error) {
    console.error('Replace failed:', error);
  }
}

/**
 * Replace all matches in the current file
 */
export async function replaceAllInCurrentFile(): Promise<void> {
  const searchState = getSearchState();
  if (!searchState.query || !state.content) return;

  try {
    const result = await invoke<{ newContent: string; replacedCount: number }>('replace_in_content', {
      query: searchState.query,
      replacement: searchState.replaceText,
      content: state.content,
      options: searchState.options,
    });

    if (result.replacedCount > 0) {
      // Update state content
      state.content = result.newContent;
      state.isDirty = true;

      // Update all line data-raw attributes
      if (editor) {
        const newLines = result.newContent.split('\n');
        const lineElements = editor.querySelectorAll('.editor-line');

        lineElements.forEach((lineElement, index) => {
          if (index < newLines.length) {
            lineElement.setAttribute('data-raw', newLines[index]);
          }
        });
      }

      // Re-render all lines
      await renderAllLines(null, state.editMode);

      // Clear matches and highlights
      setCurrentFileMatches([]);
      clearHighlights();

      alert(`Replaced ${result.replacedCount} match${result.replacedCount === 1 ? '' : 'es'}`);
    } else {
      alert('No matches found to replace');
    }
  } catch (error) {
    console.error('Replace all failed:', error);
    alert('Replace all failed: ' + error);
  }
}
