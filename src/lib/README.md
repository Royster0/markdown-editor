# Frontend Module Architecture

This directory contains the modularized frontend code for the Markdown Editor. The original `main.ts` (1,571 lines) has been refactored into focused, maintainable modules.

## Module Overview

### Core Modules

#### `types.ts`
- **Purpose**: Type definitions and interfaces
- **Exports**: `EditorState`, `FileEntry`, `RenderRequest`, `LineRenderResult`
- **Usage**: Import types throughout the application

#### `state.ts`
- **Purpose**: Application state management
- **Exports**: `state`, `markDirty()`, `updateTitle()`
- **Dependencies**: `types.ts`

#### `dom.ts`
- **Purpose**: Centralized DOM element references
- **Exports**: `editor`, `sidebar`, `fileTree`, `wordCountDisplay`, etc.
- **Usage**: Import DOM elements instead of using `document.getElementById()`

### UI & Rendering Modules

#### `ui.ts`
- **Purpose**: UI update functions
- **Exports**:
  - `updateStatistics(text)` - Update word/character counts
  - `updateCursorPosition()` - Update cursor position display
  - `getCurrentLineNumber()` - Get current line index
- **Dependencies**: `dom.ts`

#### `rendering.ts`
- **Purpose**: Markdown and LaTeX rendering
- **Exports**:
  - `renderMarkdownLine()` - Render single line via Rust backend
  - `renderMarkdownBatch()` - Batch render multiple lines
  - `renderLatex()` - Render LaTeX expressions with KaTeX
  - `renderLatexInHtml()` - Post-process HTML for LaTeX
  - `getAllLines()` - Get all editor lines
  - `getEditorContent()` - Get plain text content
  - `setEditorContent()` - Set editor content from text
  - `renderAllLines()` - Re-render all editor lines
- **Dependencies**: `types.ts`, `dom.ts`
- **External**: Tauri API, KaTeX

### Feature Modules

#### `file-operations.ts`
- **Purpose**: File I/O operations
- **Exports**:
  - `saveFile()` - Save current file
  - `saveFileAs()` - Save with new name
  - `newFile()` - Create new file
  - `openFile()` - Open file dialog
  - `loadFileContent()` - Load file from path
- **Dependencies**: `state.ts`, `dom.ts`, `rendering.ts`, `ui.ts`
- **External**: Tauri dialog, Tauri fs

#### `file-tree.ts`
- **Purpose**: File tree sidebar functionality
- **Exports**:
  - `openFolder()` - Open folder dialog
  - `toggleSidebar()` - Show/hide sidebar
- **Dependencies**: `types.ts`, `dom.ts`, `state.ts`, `file-operations.ts`
- **External**: Tauri API

#### `window-controls.ts`
- **Purpose**: Window controls and menu
- **Exports**:
  - `initWindowControls()` - Initialize all window event handlers
- **Dependencies**: `dom.ts`, `file-operations.ts`, `file-tree.ts`
- **External**: Tauri Window API

#### `editor.ts`
- **Purpose**: Editor event handling and editing logic
- **Exports**:
  - `handleCursorChange()` - Handle cursor movement
  - `handleInput()` - Handle text input
  - `initEditorEvents()` - Initialize all editor event handlers
- **Internal Functions**:
  - `handleEnterKey()` - Create new line
  - `handleBackspaceKey()` - Merge with previous line
  - `handleDeleteKey()` - Merge with next line
  - `handleTabKey()` - Insert spaces
  - `getFirstTextNode()` - Helper for cursor positioning
  - `isLineInsideBlock()` - Check if in code/math block
- **Dependencies**: `dom.ts`, `state.ts`, `rendering.ts`, `ui.ts`, `file-operations.ts`

### Entry Point

#### `main.ts`
- **Purpose**: Application initialization
- **Size**: 76 lines (down from 1,571!)
- **Responsibilities**:
  - Initialize editor with welcome content
  - Set up initial state
  - Initialize event handlers
  - Bootstrap the application
- **Dependencies**: All modules

## Dependency Graph

```
main.ts
├── state.ts → types.ts
├── ui.ts → dom.ts
├── rendering.ts → types.ts, dom.ts
├── editor.ts → dom.ts, state.ts, rendering.ts, ui.ts, file-operations.ts
├── file-operations.ts → state.ts, dom.ts, rendering.ts, ui.ts
├── file-tree.ts → types.ts, dom.ts, state.ts, file-operations.ts
└── window-controls.ts → dom.ts, file-operations.ts, file-tree.ts
```

## Benefits of This Architecture

### 1. **Maintainability**
- Each module has a single, clear responsibility
- Easy to locate and fix bugs
- Changes to one feature don't affect others

### 2. **Readability**
- Files are appropriately sized (50-500 lines)
- Clear module boundaries
- Self-documenting through structure

### 3. **Testability**
- Modules can be tested independently
- Easy to mock dependencies
- Clear inputs and outputs

### 4. **Contributor-Friendly**
- New contributors can understand one module at a time
- Clear separation of concerns
- Easy to add new features

### 5. **Performance**
- Tree-shakeable modules
- Lazy loading possibilities
- Better code splitting for bundlers

## Adding New Features

### Example: Adding a "Find and Replace" Feature

1. Create `src/lib/find-replace.ts`
2. Export functions: `findInEditor()`, `replaceInEditor()`
3. Import dependencies: `dom.ts`, `editor.ts`, `state.ts`
4. Update `main.ts` to initialize the feature
5. Add UI controls in `window-controls.ts` or create new menu module

### Example: Adding Syntax Highlighting

1. Update `rendering.ts` to add syntax highlighting logic
2. Or create `src/lib/syntax-highlighting.ts` if complex
3. Integrate with existing `renderMarkdownLine()` function
4. No changes needed to other modules

## Module Guidelines

### Do's ✅
- Keep modules focused on a single responsibility
- Export only what's needed by other modules
- Document all exported functions with JSDoc
- Use TypeScript types from `types.ts`
- Keep files under 500 lines when possible

### Don'ts ❌
- Don't create circular dependencies
- Don't duplicate code across modules
- Don't access DOM directly (use `dom.ts`)
- Don't manage state outside `state.ts`
- Don't create "utility" catch-all modules

## Migration Notes

All functionality from the original `main.ts` has been preserved:
- ✅ Markdown rendering
- ✅ LaTeX support
- ✅ File operations (open, save, new)
- ✅ File tree sidebar
- ✅ Window controls
- ✅ Editor event handling
- ✅ Cursor management
- ✅ Keyboard shortcuts
- ✅ Statistics tracking

No features were removed or changed during refactoring.
