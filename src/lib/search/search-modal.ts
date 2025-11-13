/**
 * Search modal UI component
 * Provides the visual interface for search and replace
 */

import { getSearchState, updateSearchState, updateSearchOptions } from './search-state';
import { searchInCurrentFile, goToNextMatch, goToPreviousMatch, replaceCurrentMatch, replaceAllInCurrentFile } from './current-file-search';
import { searchInFolder, getSearchResultsSummary } from './multi-file-search';
import { clearHighlights } from './search-highlighting';
import { loadFileContent } from '../file-operations';

let searchModal: HTMLElement | null = null;
let searchInput: HTMLInputElement | null = null;
let replaceInput: HTMLInputElement | null = null;
let caseSensitiveCheckbox: HTMLInputElement | null = null;
let wholeWordCheckbox: HTMLInputElement | null = null;
let regexCheckbox: HTMLInputElement | null = null;
let searchInAllFilesCheckbox: HTMLInputElement | null = null;
let matchCountSpan: HTMLElement | null = null;
let multiFileResultsDiv: HTMLElement | null = null;

/**
 * Create the search modal UI
 */
export function createSearchModal(): void {
  if (searchModal) return; // Already created

  searchModal = document.createElement('div');
  searchModal.className = 'search-modal';
  searchModal.style.cssText = `
    position: fixed;
    top: 60px;
    right: 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    padding: 16px;
    min-width: 400px;
    max-width: 600px;
    z-index: 1000;
    display: none;
    font-family: var(--font-family);
    color: var(--text-color);
  `;

  searchModal.innerHTML = `
    <div class="search-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Search</h3>
      <button class="search-close-btn" style="background: none; border: none; color: var(--text-color); cursor: pointer; font-size: 20px; padding: 0; width: 24px; height: 24px;">×</button>
    </div>

    <div class="search-inputs" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <input type="text" class="search-query-input" placeholder="Search..." style="flex: 1; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); font-family: var(--font-family); font-size: 13px;" />
        <span class="search-match-count" style="font-size: 12px; color: var(--text-muted); min-width: 80px; text-align: right;">-</span>
      </div>
      <div class="search-replace-row" style="display: none; align-items: center; gap: 8px;">
        <input type="text" class="search-replace-input" placeholder="Replace..." style="flex: 1; padding: 8px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); font-family: var(--font-family); font-size: 13px;" />
      </div>
    </div>

    <div class="search-options" style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
      <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer;">
        <input type="checkbox" class="search-case-sensitive" />
        <span>Case sensitive</span>
      </label>
      <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer;">
        <input type="checkbox" class="search-whole-word" />
        <span>Whole word</span>
      </label>
      <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer;">
        <input type="checkbox" class="search-regex" />
        <span>Regex</span>
      </label>
      <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer;">
        <input type="checkbox" class="search-all-files" />
        <span>All files</span>
      </label>
    </div>

    <div class="search-actions" style="display: flex; gap: 8px; margin-bottom: 12px;">
      <button class="search-prev-btn" style="padding: 6px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); cursor: pointer; font-size: 12px;">Previous</button>
      <button class="search-next-btn" style="padding: 6px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); cursor: pointer; font-size: 12px;">Next</button>
      <button class="search-replace-btn" style="padding: 6px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); cursor: pointer; font-size: 12px; display: none;">Replace</button>
      <button class="search-replace-all-btn" style="padding: 6px 12px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); cursor: pointer; font-size: 12px; display: none;">Replace All</button>
    </div>

    <div class="search-multi-file-results" style="display: none; max-height: 300px; overflow-y: auto; border-top: 1px solid var(--border-color); padding-top: 12px;">
      <div class="search-results-summary" style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;"></div>
      <div class="search-results-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
    </div>
  `;

  document.body.appendChild(searchModal);

  // Get references to elements
  searchInput = searchModal.querySelector('.search-query-input');
  replaceInput = searchModal.querySelector('.search-replace-input');
  caseSensitiveCheckbox = searchModal.querySelector('.search-case-sensitive');
  wholeWordCheckbox = searchModal.querySelector('.search-whole-word');
  regexCheckbox = searchModal.querySelector('.search-regex');
  searchInAllFilesCheckbox = searchModal.querySelector('.search-all-files');
  matchCountSpan = searchModal.querySelector('.search-match-count');
  multiFileResultsDiv = searchModal.querySelector('.search-multi-file-results');

  // Attach event listeners
  attachEventListeners();
}

/**
 * Attach event listeners to search modal elements
 */
function attachEventListeners(): void {
  if (!searchModal || !searchInput) return;

  const closeBtn = searchModal.querySelector('.search-close-btn');
  const prevBtn = searchModal.querySelector('.search-prev-btn');
  const nextBtn = searchModal.querySelector('.search-next-btn');
  const replaceBtn = searchModal.querySelector('.search-replace-btn');
  const replaceAllBtn = searchModal.querySelector('.search-replace-all-btn');

  // Close button
  closeBtn?.addEventListener('click', () => closeSearchModal());

  // Search input
  let searchTimeout: number | null = null;
  searchInput.addEventListener('input', () => {
    const query = searchInput!.value;
    updateSearchState({ query });

    // Debounce search
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = window.setTimeout(() => performSearch(), 300);
  });

  // Search input - Enter key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToPreviousMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'Escape') {
      closeSearchModal();
    }
  });

  // Replace input
  replaceInput?.addEventListener('input', () => {
    updateSearchState({ replaceText: replaceInput!.value });
  });

  // Options checkboxes
  caseSensitiveCheckbox?.addEventListener('change', () => {
    updateSearchOptions({ caseSensitive: caseSensitiveCheckbox!.checked });
    performSearch();
  });

  wholeWordCheckbox?.addEventListener('change', () => {
    updateSearchOptions({ wholeWord: wholeWordCheckbox!.checked });
    performSearch();
  });

  regexCheckbox?.addEventListener('change', () => {
    updateSearchOptions({ useRegex: regexCheckbox!.checked });
    performSearch();
  });

  searchInAllFilesCheckbox?.addEventListener('change', () => {
    const searchInAllFiles = searchInAllFilesCheckbox!.checked;
    updateSearchState({ searchInAllFiles });
    performSearch();

    // Show/hide multi-file results
    if (multiFileResultsDiv) {
      multiFileResultsDiv.style.display = searchInAllFiles ? 'block' : 'none';
    }
  });

  // Navigation buttons
  prevBtn?.addEventListener('click', () => {
    goToPreviousMatch();
    const searchState = getSearchState();
    updateMatchCount(searchState.currentMatchIndex + 1, searchState.totalMatches);
  });
  nextBtn?.addEventListener('click', () => {
    goToNextMatch();
    const searchState = getSearchState();
    updateMatchCount(searchState.currentMatchIndex + 1, searchState.totalMatches);
  });

  // Replace buttons
  replaceBtn?.addEventListener('click', () => replaceCurrentMatch());
  replaceAllBtn?.addEventListener('click', () => replaceAllInCurrentFile());
}

/**
 * Perform search based on current state
 */
async function performSearch(): Promise<void> {
  const searchState = getSearchState();

  if (!searchState.query) {
    clearHighlights();
    updateMatchCount(0, 0);
    return;
  }

  if (searchState.searchInAllFiles) {
    // Multi-file search
    const results = await searchInFolder(searchState.query, searchState.options);
    displayMultiFileResults(results);
  } else {
    // Current file search
    await searchInCurrentFile(searchState.query, searchState.options);
    const { currentMatchIndex, totalMatches } = getSearchState();
    updateMatchCount(currentMatchIndex + 1, totalMatches);
  }
}

/**
 * Update match count display
 */
function updateMatchCount(current: number, total: number): void {
  if (!matchCountSpan) return;

  if (total === 0) {
    matchCountSpan.textContent = 'No matches';
  } else {
    matchCountSpan.textContent = `${current} of ${total}`;
  }
}

/**
 * Display multi-file search results
 */
function displayMultiFileResults(results: any[]): void {
  if (!multiFileResultsDiv) return;

  const summaryDiv = multiFileResultsDiv.querySelector('.search-results-summary');
  const listDiv = multiFileResultsDiv.querySelector('.search-results-list');

  if (!summaryDiv || !listDiv) return;

  // Update summary
  summaryDiv.textContent = getSearchResultsSummary(results);

  // Clear previous results
  listDiv.innerHTML = '';

  // Display results
  results.forEach((result) => {
    const fileItem = document.createElement('div');
    fileItem.style.cssText = `
      padding: 8px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;

    const fileName = result.filePath.split('/').pop() || result.filePath;
    const matchCount = result.matches.length;

    fileItem.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">${fileName}</div>
      <div style="color: var(--text-muted);">${matchCount} match${matchCount === 1 ? '' : 'es'}</div>
    `;

    fileItem.addEventListener('click', () => {
      // Open the file
      loadFileContent(result.filePath);
      // Perform search in the newly opened file
      setTimeout(() => performSearch(), 100);
    });

    listDiv.appendChild(fileItem);
  });
}

/**
 * Open the search modal
 */
export function openSearchModal(withReplace: boolean = false): void {
  if (!searchModal) {
    createSearchModal();
  }

  if (!searchModal) return;

  searchModal.style.display = 'block';
  updateSearchState({ isOpen: true, showReplace: withReplace });

  // Show/hide replace controls
  const replaceRow = searchModal.querySelector('.search-replace-row') as HTMLElement;
  const replaceBtn = searchModal.querySelector('.search-replace-btn') as HTMLElement;
  const replaceAllBtn = searchModal.querySelector('.search-replace-all-btn') as HTMLElement;

  if (replaceRow && replaceBtn && replaceAllBtn) {
    replaceRow.style.display = withReplace ? 'flex' : 'none';
    replaceBtn.style.display = withReplace ? 'block' : 'none';
    replaceAllBtn.style.display = withReplace ? 'block' : 'none';
  }

  // Focus search input
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }

  // If there's a selection in the editor, use it as the search query
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    const selectedText = selection.toString();
    if (searchInput) {
      searchInput.value = selectedText;
      updateSearchState({ query: selectedText });
      performSearch();
    }
  }
}

/**
 * Close the search modal
 */
export function closeSearchModal(): void {
  if (!searchModal) return;

  searchModal.style.display = 'none';
  updateSearchState({ isOpen: false });
  clearHighlights();
}

/**
 * Toggle the search modal
 */
export function toggleSearchModal(withReplace: boolean = false): void {
  const searchState = getSearchState();
  if (searchState.isOpen) {
    closeSearchModal();
  } else {
    openSearchModal(withReplace);
  }
}
