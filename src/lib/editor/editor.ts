/**
 * Editor module - Main orchestrator
 * Coordinates editor events, keyboard handlers, and utilities
 */

// Re-export everything for backward compatibility
export { getFirstTextNode, isLineInsideBlock } from "./editor-utils";
export { handleEnterKey, handleBackspaceKey, handleDeleteKey, handleTabKey } from "./editor-keys";
export { handleCursorChange, handleInput, initEditorEvents } from "./editor-events";
