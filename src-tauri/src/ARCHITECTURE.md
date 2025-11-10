# Rust Backend Architecture

The Rust backend has been refactored for better maintainability and clarity. The original `markdown.rs` (420 lines) has been split into focused modules.

## Module Overview

### `markdown.rs` (Main Module)
- **Lines**: ~270 (down from 420)
- **Purpose**: Coordinate markdown rendering
- **Responsibilities**:
  - Main `render_markdown_line()` function
  - Block-level element detection (headers, lists, blockquotes)
  - Coordination between block and inline rendering
  - HTML structure generation
- **Exports**: `RenderRequest`, `LineRenderResult`, `render_markdown_line()`

### `block_detection.rs`
- **Lines**: ~110
- **Purpose**: Detect code blocks and math blocks
- **Exports**:
  - `is_in_code_block(line_index, all_lines)` → `(in_block, is_start, is_end)`
  - `is_in_math_block(line_index, all_lines)` → `(in_block, is_start, is_end)`
- **Why Separate**:
  - Complex context-aware logic
  - Reusable across different rendering contexts
  - Easier to test independently
  - Future: Could support nested blocks

### `inline_rendering.rs`
- **Lines**: ~140
- **Purpose**: Render inline markdown elements
- **Exports**:
  - `render_inline_markdown(text)` → HTML with markers hidden
  - `render_inline_markdown_with_markers(text)` → HTML with markers visible
- **Handles**:
  - Bold (`**text**`, `__text__`)
  - Italic (`*text*`, `_text_`)
  - Bold+Italic (`***text***`)
  - Strikethrough (`~~text~~`)
  - Inline code (`` `code` ``)
  - Links (`[text](url)`)
- **Why Separate**:
  - Self-contained regex logic
  - Can be reused for different contexts
  - Easy to add new inline elements
  - Testable in isolation

## Architecture Benefits

### Before Refactoring
```
markdown.rs (420 lines)
├── All regex patterns (18 statics)
├── Block detection functions
├── Inline rendering functions
├── Main rendering function
└── Tests
```

**Issues**:
- Hard to navigate
- Difficult to test specific features
- Unclear separation of concerns
- Would get worse with more features

### After Refactoring
```
markdown.rs (270 lines)
├── Block-level rendering
├── Coordination logic
└── Tests

block_detection.rs (110 lines)
├── Code block detection
├── Math block detection
└── Tests

inline_rendering.rs (140 lines)
├── Inline element patterns
├── Rendering with/without markers
└── Tests
```

**Benefits**:
- Clear separation of concerns
- Each module is independently testable
- Easy to add new features
- Better documentation structure

## Key Design Decisions

### 1. Context-Aware Rendering
Block detection scans from the beginning of the document to maintain proper context:
```rust
// Knows if we're inside a code block
let (in_block, is_start, is_end) = is_in_code_block(line_index, all_lines);
```

### 2. Two-Phase Rendering
1. **Rust Backend** (this module):
   - Block detection
   - Inline markdown (bold, italic, links)
   - HTML structure

2. **Frontend** (KaTeX):
   - LaTeX math rendering
   - Complex math layout

**Why**: KaTeX is a JavaScript library and works best on the frontend.

### 3. Edit Mode Support
Two rendering modes:
- **Editing**: Show markdown markers for user to edit
- **Preview**: Hide markers, show formatted output

Implemented via `is_editing` flag in `RenderRequest`.

### 4. Pre-compiled Regex
All regex patterns use `once_cell::Lazy` for compilation once at startup:
```rust
static BOLD_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\*\*(.+?)\*\*").unwrap());
```

**Performance**: Regex compilation is expensive; this optimization is critical.

## Testing Strategy

Each module has comprehensive tests:

### `block_detection.rs`
- Code block boundaries
- Math block boundaries
- Nested context handling
- Edge cases (empty lines, etc.)

### `inline_rendering.rs`
- Each inline element type
- Combinations (bold + italic)
- Edge cases (nested, malformed)
- Marker visibility in edit mode

### `markdown.rs`
- End-to-end rendering
- Integration of block + inline
- Different markdown elements
- Edit mode vs preview mode

## Adding New Features

### Example: Adding Image Support

**Option 1: Inline Element** (if images are `![alt](url)`)
1. Add to `inline_rendering.rs`
2. Add new regex pattern
3. Update rendering functions
4. Add tests

**Option 2: Block Element** (if images need special layout)
1. Add to `markdown.rs`
2. Add detection logic in main render function
3. Add tests

### Example: Adding Tables

1. Create new `table_rendering.rs` module (tables are complex)
2. Add table detection in `markdown.rs`
3. Call table renderer when detected
4. Add comprehensive tests

### Example: Adding Syntax Highlighting

1. Update `block_detection.rs` to capture language info
2. Add new dependency: `syntect` or similar
3. Update code block rendering in `markdown.rs`
4. Return language metadata to frontend

## Performance Considerations

### Current Optimizations
1. **Pre-compiled Regex**: ~50x faster than runtime compilation
2. **Single-pass Parsing**: Each line rendered in one pass
3. **Parallel Batch Rendering**: Uses Rayon for >50 lines (in `lib.rs`)
4. **Minimal Allocations**: String reuse where possible

### Future Optimizations
- [ ] Incremental rendering (only changed lines)
- [ ] Caching frequently-used patterns
- [ ] SIMD for block detection
- [ ] Custom parser (replace regex for common patterns)

## Module Visibility

All modules are currently `mod` (private) within `markdown.rs`:
```rust
mod block_detection;
mod inline_rendering;
```

**Why**: These are implementation details. Only `markdown.rs` exports the public API used by `lib.rs`.

**Future**: If other modules need block detection, consider making it `pub mod`.

## Integration with Frontend

The Rust backend is called via Tauri commands in `lib.rs`:

```rust
#[tauri::command]
fn render_markdown(request: RenderRequest) -> LineRenderResult {
    render_markdown_line(request)
}

#[tauri::command]
fn render_markdown_batch(requests: Vec<RenderRequest>) -> Vec<LineRenderResult> {
    // Uses Rayon for parallel processing
}
```

Frontend TypeScript code calls these via:
```typescript
import { invoke } from "@tauri-apps/api/core";

const result = await invoke<LineRenderResult>("render_markdown", { request });
```

## Code Quality Standards

### Formatting
- Use `rustfmt` for consistent formatting
- Run `cargo fmt` before committing

### Linting
- Use `clippy` for catching common issues
- Run `cargo clippy -- -D warnings`

### Testing
- All public functions must have tests
- Run `cargo test` before committing
- Aim for >80% code coverage

### Documentation
- Document all public functions with doc comments
- Include examples in doc comments
- Keep this ARCHITECTURE.md updated
