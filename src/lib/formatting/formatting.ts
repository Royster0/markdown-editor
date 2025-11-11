/**
 * Formatting module - Main orchestrator
 * Coordinates text editing, markdown formatting, and view controls
 */

// Re-export for backward compatibility
export { getSelectionInfo, insertOrWrapText, selectAll, undo, redo, copy, cut, paste } from "./text-editing-utils";
export { toggleBold, toggleItalic, toggleStrikethrough, insertLink, insertCode, insertCodeBlock, increaseHeadingLevel, decreaseHeadingLevel } from "./markdown-formatting";
export { openFind, openReplace, zoomIn, zoomOut, resetZoom } from "./view-controls";
