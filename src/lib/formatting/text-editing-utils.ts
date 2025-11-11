/**
 * Text editing utilities
 * Basic text selection and editing operations
 */

import { editor } from "../core/dom";
import { handleInput } from "../editor/editor-events";

/**
 * Get the current selection info
 */
export function getSelectionInfo() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString();

  return { selection, range, selectedText };
}

/**
 * Insert text at cursor or wrap selected text
 */
export function insertOrWrapText(prefix: string, suffix: string = "", defaultText: string = "") {
  const info = getSelectionInfo();
  if (!info) return;

  const { range, selectedText } = info;

  // If there's selected text, wrap it
  if (selectedText) {
    const wrappedText = prefix + selectedText + suffix;
    range.deleteContents();
    range.insertNode(document.createTextNode(wrappedText));

    // Move cursor after the inserted text
    range.collapse(false);
  } else {
    // Insert prefix, default text, and suffix
    const textToInsert = prefix + defaultText + suffix;
    range.insertNode(document.createTextNode(textToInsert));

    // Move cursor between prefix and suffix (if defaultText exists)
    if (defaultText) {
      range.setStart(range.startContainer, range.startOffset + prefix.length);
      range.setEnd(range.startContainer, range.startOffset + defaultText.length);
    } else {
      range.collapse(false);
    }
  }

  // Trigger input event to update rendering
  handleInput();
}

/**
 * Select all text in the editor
 */
export function selectAll() {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * Undo - uses browser's native undo
 */
export function undo() {
  document.execCommand('undo');
}

/**
 * Redo - uses browser's native redo
 */
export function redo() {
  document.execCommand('redo');
}

/**
 * Copy - uses browser's native copy
 */
export function copy() {
  document.execCommand('copy');
}

/**
 * Cut - uses browser's native cut
 */
export function cut() {
  document.execCommand('cut');
}

/**
 * Paste - uses browser's native paste
 */
export function paste() {
  document.execCommand('paste');
}
