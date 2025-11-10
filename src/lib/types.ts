/**
 * Type definitions for the Markdown Editor
 */

/**
 * Application state interface
 */
export interface EditorState {
  /** Path to the currently open file */
  currentFile: string | null;
  /** Current editor content */
  content: string;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether edit mode is active (showing markdown markers) */
  editMode: boolean;
  /** Current line number (0-indexed) */
  currentLine: number | null;
  /** Current folder path for file tree */
  currentFolder: string | null;
  /** Whether sidebar is visible */
  sidebarVisible: boolean;
}

/**
 * File entry in the file tree
 */
export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[];
}

/**
 * Request for rendering a markdown line (sent to Rust backend)
 */
export interface RenderRequest {
  line: string;
  line_index: number;
  all_lines: string[];
  is_editing: boolean;
}

/**
 * Result of rendering a markdown line (received from Rust backend)
 */
export interface LineRenderResult {
  html: string;
  is_code_block_boundary: boolean;
}
