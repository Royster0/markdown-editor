/**
 * Application state management
 */

import { EditorState } from "./types";

/**
 * Global application state
 */
export const state: EditorState = {
  currentFile: null,
  content: "",
  isDirty: false,
  editMode: false,
  currentLine: null,
  currentFolder: null,
  sidebarVisible: true,
};

/**
 * Mark document as dirty (has unsaved changes)
 */
export function markDirty(): void {
  if (!state.isDirty) {
    state.isDirty = true;
    updateTitle();
  }
}

/**
 * Update the window title based on current file and dirty state
 */
export function updateTitle(): void {
  const fileName = state.currentFile
    ? state.currentFile.split(/[\\/]/).pop() || "Untitled.md"
    : "Untitled.md";
  document.title = state.isDirty
    ? `${fileName} • - Markdown Editor`
    : `${fileName} - Markdown Editor`;
}
