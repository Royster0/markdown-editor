/**
 * UI update functions for statistics, cursor position, etc.
 */

import { editor, wordCountDisplay, charCountDisplay, cursorPositionDisplay } from "./dom";

/**
 * Update word and character count displays
 * @param text - The text content to analyze
 */
export function updateStatistics(text: string): void {
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;

  wordCountDisplay.textContent = `${words} word${words !== 1 ? "s" : ""}`;
  charCountDisplay.textContent = `${chars} character${chars !== 1 ? "s" : ""}`;
}

/**
 * Update cursor position display (line and column)
 */
export function updateCursorPosition(): void {
  const lineNum = getCurrentLineNumber();
  const line = lineNum + 1;

  const selection = window.getSelection();
  let col = 1;

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    const lineDiv = editor.childNodes[lineNum] as HTMLElement;

    if (lineDiv) {
      preCaretRange.selectNodeContents(lineDiv);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      col = preCaretRange.toString().length + 1;
    }
  }

  cursorPositionDisplay.textContent = `Ln ${line}, Col ${col}`;
}

/**
 * Get current line number from cursor position
 * @returns The current line number (0-indexed)
 */
export function getCurrentLineNumber(): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const lines = editor.childNodes;

  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode as Node;
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === node || lines[i].contains(node)) {
      return i;
    }
  }

  return 0;
}
