/**
 * View controls module
 * Handles find, replace, and zoom controls
 */

import { editor } from "../core/dom";

/**
 * Open find dialog (browser's native find)
 */
export function openFind() {
  // Focus the editor first to ensure find works within the editor context
  editor.focus();

  // The native browser find will be triggered since we don't prevent default
  // for this action in the keybind handler
}

/**
 * Open replace dialog (browser's native replace)
 */
export function openReplace() {
  // Focus the editor first
  editor.focus();

  // The native browser replace will be triggered since we don't prevent default
  // for this action in the keybind handler
}

/**
 * Zoom in
 */
export function zoomIn() {
  const currentZoom = parseFloat(getComputedStyle(document.documentElement).fontSize);
  document.documentElement.style.fontSize = (currentZoom + 1) + 'px';
}

/**
 * Zoom out
 */
export function zoomOut() {
  const currentZoom = parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (currentZoom > 8) {
    document.documentElement.style.fontSize = (currentZoom - 1) + 'px';
  }
}

/**
 * Reset zoom to default (16px)
 */
export function resetZoom() {
  document.documentElement.style.fontSize = '16px';
}
