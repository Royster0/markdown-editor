/**
 * Editor keyboard handlers
 * Handles special keys: Enter, Backspace, Delete, Tab
 */

import { editor } from "../core/dom";
import { state, markDirty } from "../core/state";
import {
  renderMarkdownLine,
  renderMarkdownBatch,
  getAllLines,
  getEditorContent,
} from "./rendering";
import { updateStatistics, getCurrentLineNumber } from "../ui/ui";
import { RenderRequest } from "../core/types";
import { markCurrentTabDirty, updateCurrentTabContent } from "../tabs/tabs";
import { getFirstTextNode } from "./editor-utils";

/**
 * Handle Enter key - create new line and split at cursor
 */
export async function handleEnterKey(e: KeyboardEvent) {
  e.preventDefault();

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const currentLineNum = getCurrentLineNumber();
  const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

  if (!currentLine) return;

  const currentRawText = currentLine.textContent || "";

  // Find cursor position
  let cursorPos = 0;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(currentLine);
  preRange.setEnd(range.startContainer, range.startOffset);
  cursorPos = preRange.toString().length;

  // Split the text at cursor position
  const beforeCursor = currentRawText.substring(0, cursorPos);
  const afterCursor = currentRawText.substring(cursorPos);

  // Update current line
  currentLine.setAttribute("data-raw", beforeCursor);
  currentLine.innerHTML = await renderMarkdownLine(beforeCursor, false);
  currentLine.classList.remove("editing");

  // Create new line
  const newLine = document.createElement("div");
  newLine.className = "editor-line";
  newLine.setAttribute("data-raw", afterCursor);
  newLine.setAttribute("data-line", String(currentLineNum + 1));
  newLine.innerHTML = afterCursor || "<br>";
  newLine.classList.add("editing");

  // Insert after current line
  if (currentLine.nextSibling) {
    editor.insertBefore(newLine, currentLine.nextSibling);
  } else {
    editor.appendChild(newLine);
  }

  // Update line numbers
  for (let i = currentLineNum + 2; i < editor.childNodes.length; i++) {
    const line = editor.childNodes[i] as HTMLElement;
    line.setAttribute("data-line", String(i));
  }

  // Re-render affected lines
  const allLines = getAllLines();
  const requests: RenderRequest[] = [];
  for (let i = currentLineNum; i < editor.childNodes.length; i++) {
    const lineDiv = editor.childNodes[i] as HTMLElement;
    const rawText = lineDiv.getAttribute("data-raw") || "";
    const isEditing = i === currentLineNum + 1;
    requests.push({
      line: rawText,
      line_index: i,
      all_lines: allLines,
      is_editing: isEditing,
    });
  }

  const results = await renderMarkdownBatch(requests);
  let resultIndex = 0;
  for (let i = currentLineNum; i < editor.childNodes.length; i++) {
    const lineDiv = editor.childNodes[i] as HTMLElement;
    const isEditing = i === currentLineNum + 1;

    if (results[resultIndex]) {
      lineDiv.innerHTML = results[resultIndex].html;
    }

    if (isEditing) {
      lineDiv.classList.add("editing");
    } else {
      lineDiv.classList.remove("editing");
    }
    resultIndex++;
  }

  // Move cursor to beginning of new line
  const newRange = document.createRange();
  const newSelection = window.getSelection();

  if (newLine.firstChild) {
    newRange.setStart(newLine.firstChild, 0);
  } else {
    newRange.setStart(newLine, 0);
  }
  newRange.collapse(true);
  newSelection?.removeAllRanges();
  newSelection?.addRange(newRange);

  // Update state
  state.currentLine = currentLineNum + 1;
  state.content = getEditorContent();
  updateStatistics(state.content);
  updateCurrentTabContent(state.content);
  markCurrentTabDirty();
}

/**
 * Handle Backspace key - merge with previous line if at start
 */
export async function handleBackspaceKey(e: KeyboardEvent) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const currentLineNum = getCurrentLineNumber();
  const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

  if (!currentLine || currentLineNum === 0) return;

  // Check if cursor is at the start
  const preRange = range.cloneRange();
  preRange.selectNodeContents(currentLine);
  preRange.setEnd(range.startContainer, range.startOffset);
  const cursorPos = preRange.toString().length;

  if (cursorPos === 0 && range.collapsed) {
    e.preventDefault();

    const prevLine = editor.childNodes[currentLineNum - 1] as HTMLElement;
    if (!prevLine) return;

    const prevText = prevLine.getAttribute("data-raw") || "";
    const currentText = currentLine.getAttribute("data-raw") || "";
    const mergePoint = prevText.length;
    const mergedText = prevText + currentText;

    // Update previous line
    prevLine.setAttribute("data-raw", mergedText);
    prevLine.innerHTML = await renderMarkdownLine(mergedText, true);
    prevLine.classList.add("editing");

    // Remove current line
    editor.removeChild(currentLine);

    // Update line numbers
    for (let i = currentLineNum; i < editor.childNodes.length; i++) {
      const line = editor.childNodes[i] as HTMLElement;
      line.setAttribute("data-line", String(i));
    }

    // Re-render affected lines
    const allLines = getAllLines();
    const requests: RenderRequest[] = [];
    for (let i = currentLineNum - 1; i < editor.childNodes.length; i++) {
      const lineDiv = editor.childNodes[i] as HTMLElement;
      const rawText = lineDiv.getAttribute("data-raw") || "";
      const isEditing = i === currentLineNum - 1;
      requests.push({
        line: rawText,
        line_index: i,
        all_lines: allLines,
        is_editing: isEditing,
      });
    }

    const results = await renderMarkdownBatch(requests);
    let resultIndex = 0;
    for (let i = currentLineNum - 1; i < editor.childNodes.length; i++) {
      const lineDiv = editor.childNodes[i] as HTMLElement;
      const isEditing = i === currentLineNum - 1;

      if (results[resultIndex]) {
        lineDiv.innerHTML = results[resultIndex].html;
      }

      if (isEditing) {
        lineDiv.classList.add("editing");
      } else {
        lineDiv.classList.remove("editing");
      }
      resultIndex++;
    }

    // Move cursor to merge point
    const textNode = getFirstTextNode(prevLine);
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const newRange = document.createRange();
      const newSelection = window.getSelection();
      const offset = Math.min(mergePoint, textNode.textContent?.length || 0);
      newRange.setStart(textNode, offset);
      newRange.collapse(true);
      newSelection?.removeAllRanges();
      newSelection?.addRange(newRange);
    } else {
      // Fallback: just focus the editor
      editor.focus();
    }

    // Update state
    state.currentLine = currentLineNum - 1;
    state.content = getEditorContent();
    updateStatistics(state.content);
    markDirty();
  }
}

/**
 * Handle Delete key - merge with next line if at end
 */
export async function handleDeleteKey(e: KeyboardEvent) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const currentLineNum = getCurrentLineNumber();
  const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

  if (!currentLine) return;

  // Check if cursor is at the end
  const currentText = currentLine.textContent || "";
  const preRange = range.cloneRange();
  preRange.selectNodeContents(currentLine);
  preRange.setEnd(range.startContainer, range.startOffset);
  const cursorPos = preRange.toString().length;

  if (cursorPos === currentText.length && range.collapsed) {
    const nextLine = editor.childNodes[currentLineNum + 1] as HTMLElement;
    if (!nextLine) return;

    e.preventDefault();

    const currentRawText = currentLine.getAttribute("data-raw") || "";
    const nextText = nextLine.getAttribute("data-raw") || "";
    const mergedText = currentRawText + nextText;

    // Update current line
    currentLine.setAttribute("data-raw", mergedText);
    currentLine.innerHTML = await renderMarkdownLine(mergedText, true);
    currentLine.classList.add("editing");

    // Remove next line
    editor.removeChild(nextLine);

    // Update line numbers
    for (let i = currentLineNum + 1; i < editor.childNodes.length; i++) {
      const line = editor.childNodes[i] as HTMLElement;
      line.setAttribute("data-line", String(i));
    }

    // Re-render affected lines
    const allLines = getAllLines();
    const requests: RenderRequest[] = [];
    for (let i = currentLineNum; i < editor.childNodes.length; i++) {
      const lineDiv = editor.childNodes[i] as HTMLElement;
      const rawText = lineDiv.getAttribute("data-raw") || "";
      const isEditing = i === currentLineNum;
      requests.push({
        line: rawText,
        line_index: i,
        all_lines: allLines,
        is_editing: isEditing,
      });
    }

    const results = await renderMarkdownBatch(requests);
    let resultIndex = 0;
    for (let i = currentLineNum; i < editor.childNodes.length; i++) {
      const lineDiv = editor.childNodes[i] as HTMLElement;
      const isEditing = i === currentLineNum;

      if (results[resultIndex]) {
        lineDiv.innerHTML = results[resultIndex].html;
      }

      if (isEditing) {
        lineDiv.classList.add("editing");
      } else {
        lineDiv.classList.remove("editing");
      }
      resultIndex++;
    }

    // Keep cursor at same position
    const textNode = currentLine.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const newRange = document.createRange();
      const newSelection = window.getSelection();
      const offset = Math.min(cursorPos, textNode.textContent?.length || 0);
      newRange.setStart(textNode, offset);
      newRange.collapse(true);
      newSelection?.removeAllRanges();
      newSelection?.addRange(newRange);
    }

    // Update state
    state.content = getEditorContent();
    updateStatistics(state.content);
    markDirty();
  }
}

/**
 * Handle Tab key - insert two spaces
 */
export function handleTabKey(e: KeyboardEvent) {
  e.preventDefault();
  document.execCommand("insertText", false, "  ");
}
