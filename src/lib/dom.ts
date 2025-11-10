/**
 * DOM element references
 *
 * This module provides centralized access to all DOM elements used in the application.
 */

/**
 * Main editor element
 */
export const editor = document.getElementById("editor") as HTMLDivElement;

/**
 * Word count display element
 */
export const wordCountDisplay = document.getElementById(
  "word-count"
) as HTMLSpanElement;

/**
 * Character count display element
 */
export const charCountDisplay = document.getElementById(
  "char-count"
) as HTMLSpanElement;

/**
 * Cursor position display element
 */
export const cursorPositionDisplay = document.getElementById(
  "cursor-position"
) as HTMLSpanElement;

/**
 * Edit mode toggle button
 */
export const editModeToggle = document.getElementById(
  "edit-mode-toggle"
) as HTMLButtonElement;

/**
 * Sidebar element
 */
export const sidebar = document.getElementById("sidebar") as HTMLDivElement;

/**
 * File tree container
 */
export const fileTree = document.getElementById("file-tree") as HTMLDivElement;

/**
 * File menu button
 */
export const fileMenuBtn = document.getElementById("file-menu-btn");

/**
 * File menu element
 */
export const fileMenu = document.getElementById("file-menu");

/**
 * Editor container element
 */
export const editorContainer = document.querySelector(
  ".editor-container"
) as HTMLElement;
