import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import katex from "katex";

// Application state
interface EditorState {
  currentFile: string | null;
  content: string;
  isDirty: boolean;
  editMode: boolean;
  currentLine: number | null;
}

const state: EditorState = {
  currentFile: null,
  content: "",
  isDirty: false,
  editMode: false,
  currentLine: null,
};

// DOM elements
const editor = document.getElementById("editor") as HTMLDivElement;
const fileNameDisplay = document.getElementById("file-name") as HTMLSpanElement;
const wordCountDisplay = document.getElementById(
  "word-count"
) as HTMLSpanElement;
const charCountDisplay = document.getElementById(
  "char-count"
) as HTMLSpanElement;
const cursorPositionDisplay = document.getElementById(
  "cursor-position"
) as HTMLSpanElement;
const editModeToggle = document.getElementById(
  "edit-mode-toggle"
) as HTMLButtonElement;

// Types for Rust backend communication
interface RenderRequest {
  line: string;
  line_index: number;
  all_lines: string[];
  is_editing: boolean;
}

interface LineRenderResult {
  html: string;
  is_code_block_boundary: boolean;
}

// Parse and render LaTeX expressions
function renderLatex(text: string): string {
  // Replace display math $$ ... $$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
      });
    } catch (e) {
      return match;
    }
  });

  // Replace inline math $ ... $ (but not $$)
  text = text.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch (e) {
      return match;
    }
  });

  return text;
}

// Convert markdown line to HTML with styling (using Rust backend)
async function renderMarkdownLine(line: string, isEditing: boolean, lineIndex?: number, allLines?: string[]): Promise<string> {
  // For safety, provide defaults if lineIndex or allLines is undefined
  const safeLineIndex = lineIndex ?? 0;
  const safeAllLines = allLines ?? [line];

  const request: RenderRequest = {
    line,
    line_index: safeLineIndex,
    all_lines: safeAllLines,
    is_editing: isEditing,
  };

  try {
    const result = await invoke<LineRenderResult>("render_markdown", { request });
    // Post-process the HTML to add LaTeX rendering
    return renderLatexInHtml(result.html);
  } catch (error) {
    console.error("Error rendering markdown:", error);
    // Fallback to escaped text
    return escapeHtml(line);
  }
}

// Batch render multiple lines for better performance
async function renderMarkdownBatch(requests: RenderRequest[]): Promise<LineRenderResult[]> {
  try {
    const results = await invoke<LineRenderResult[]>("render_markdown_batch", { requests });
    // Post-process all results to add LaTeX rendering
    return results.map((result: LineRenderResult) => ({
      ...result,
      html: renderLatexInHtml(result.html)
    }));
  } catch (error) {
    console.error("Error batch rendering markdown:", error);
    return requests.map(req => ({
      html: escapeHtml(req.line),
      is_code_block_boundary: false
    }));
  }
}

// Post-process HTML to render LaTeX (frontend-only since we use KaTeX)
// Optimized: only process if line contains LaTeX markers or is a math block
function renderLatexInHtml(html: string): string {
  // Check for math block lines and render them with KaTeX in display mode
  if (html.includes('class="math-block-line"')) {
    return html.replace(/<span class="math-block-line">([^<]+)<\/span>/g, (match, content) => {
      try {
        const latex = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        const rendered = katex.renderToString(latex.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        return `<span class="math-block-line">${rendered}</span>`;
      } catch (e) {
        return match;
      }
    });
  }

  // Quick check: if no $ symbol, skip LaTeX processing entirely
  if (!html.includes('$')) {
    return html;
  }
  return renderLatex(html);
}

// Escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Get current line number from cursor position
function getCurrentLineNumber(): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const lines = editor.childNodes;

  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode as Node;
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === node || lines[i].contains(node)) {
      return i;
    }
  }

  return 0;
}

// Get all raw line strings from editor
function getAllLines(): string[] {
  const lines: string[] = [];
  for (let i = 0; i < editor.childNodes.length; i++) {
    const node = editor.childNodes[i];
    if (node.nodeName === "DIV") {
      lines.push((node as HTMLElement).getAttribute("data-raw") || "");
    }
  }
  return lines;
}

// Get plain text content from editor
function getEditorContent(): string {
  return getAllLines().join("\n");
}

// Set editor content from plain text
async function setEditorContent(text: string) {
  // Split on both Unix (\n) and Windows (\r\n) line endings
  const lines = text.split(/\r?\n/).map((line: string) => line.trimEnd());
  editor.innerHTML = "";

  // Create requests for batch rendering
  const requests: RenderRequest[] = lines.map((line, index) => ({
    line,
    line_index: index,
    all_lines: lines,
    is_editing: false,
  }));

  // Batch render all lines
  const results = await renderMarkdownBatch(requests);

  // Use DocumentFragment for efficient DOM operations (single reflow)
  const fragment = document.createDocumentFragment();

  results.forEach((result, index) => {
    const lineDiv = document.createElement("div");
    lineDiv.className = "editor-line";
    lineDiv.setAttribute("data-raw", lines[index]);
    lineDiv.setAttribute("data-line", String(index));
    lineDiv.innerHTML = result.html;
    fragment.appendChild(lineDiv);
  });

  // Single DOM append (much faster than individual appends)
  editor.appendChild(fragment);
}

// Render all lines
async function renderAllLines() {
  const allLines = getAllLines();

  // Create requests for batch rendering
  const requests: RenderRequest[] = allLines.map((line, i) => ({
    line,
    line_index: i,
    all_lines: allLines,
    is_editing: i === state.currentLine && state.editMode,
  }));

  // Batch render all lines
  const results = await renderMarkdownBatch(requests);

  // Update DOM
  for (let i = 0; i < editor.childNodes.length; i++) {
    const lineDiv = editor.childNodes[i] as HTMLElement;
    const isCurrentLine = i === state.currentLine && state.editMode;

    if (results[i]) {
      lineDiv.innerHTML = results[i].html;
    }

    if (isCurrentLine) {
      lineDiv.classList.add("editing");
    } else {
      lineDiv.classList.remove("editing");
    }
  }
}

// Handle input
editor.addEventListener("input", async () => {
  const currentLineNum = getCurrentLineNumber();
  const lineDiv = editor.childNodes[currentLineNum] as HTMLElement;

  if (lineDiv) {
    const rawText = lineDiv.textContent || "";
    lineDiv.setAttribute("data-raw", rawText);

    // Save cursor position before re-rendering
    const selection = window.getSelection();
    let cursorOffset = 0;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(lineDiv);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorOffset = preCaretRange.toString().length;
    }

    // Re-render the line with editing mode to update styling dynamically
    const allLines = getAllLines();
    const html = await renderMarkdownLine(rawText, true, currentLineNum, allLines);
    lineDiv.innerHTML = html;

    // Restore cursor position
    try {
      const textNode = lineDiv.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const newRange = document.createRange();
        const newSelection = window.getSelection();
        const offset = Math.min(cursorOffset, textNode.textContent?.length || 0);
        newRange.setStart(textNode, offset);
        newRange.collapse(true);
        newSelection?.removeAllRanges();
        newSelection?.addRange(newRange);
      } else if (lineDiv.childNodes.length > 0) {
        // Handle complex nodes (like spans for headings)
        const newRange = document.createRange();
        const newSelection = window.getSelection();

        // Try to find the right text node and position
        let currentOffset = 0;
        let targetNode: Node | null = null;
        let targetOffset = 0;

        const findTextNode = (node: Node): boolean => {
          if (node.nodeType === Node.TEXT_NODE) {
            const textLength = node.textContent?.length || 0;
            if (currentOffset + textLength >= cursorOffset) {
              targetNode = node;
              targetOffset = cursorOffset - currentOffset;
              return true;
            }
            currentOffset += textLength;
          } else {
            for (let i = 0; i < node.childNodes.length; i++) {
              if (findTextNode(node.childNodes[i])) {
                return true;
              }
            }
          }
          return false;
        };

        findTextNode(lineDiv);

        if (targetNode) {
          newRange.setStart(targetNode, targetOffset);
          newRange.collapse(true);
          newSelection?.removeAllRanges();
          newSelection?.addRange(newRange);
        }
      }
    } catch (e) {
      // Cursor restoration failed, cursor will be at start
      console.warn("Failed to restore cursor position:", e);
    }
  }

  state.content = getEditorContent();
  updateStatistics(state.content);
  markDirty();
});

// Handle cursor movement and focus
editor.addEventListener("click", handleCursorChange);
editor.addEventListener("keyup", handleCursorChange);

// Handle focus - put cursor at end if clicking in empty space
editor.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;

  // If clicking on the editor itself (not a line), add a new line at the end
  if (target === editor || target.classList.contains("editor-container")) {
    e.preventDefault();

    // Ensure there's at least one line
    if (editor.childNodes.length === 0) {
      const newLine = document.createElement("div");
      newLine.className = "editor-line";
      newLine.setAttribute("data-raw", "");
      newLine.setAttribute("data-line", "0");
      newLine.innerHTML = "<br>";
      editor.appendChild(newLine);
    }

    // Focus the last line
    const lastLine = editor.lastChild as HTMLElement;
    if (lastLine) {
      const range = document.createRange();
      const selection = window.getSelection();

      // Place cursor at the end of the last line
      if (lastLine.childNodes.length > 0) {
        const lastNode = lastLine.childNodes[lastLine.childNodes.length - 1];
        if (lastNode.nodeType === Node.TEXT_NODE) {
          range.setStart(lastNode, lastNode.textContent?.length || 0);
        } else {
          range.setStart(lastLine, lastLine.childNodes.length);
        }
      } else {
        range.setStart(lastLine, 0);
      }

      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Update state
      state.currentLine = editor.childNodes.length - 1;
      handleCursorChange();
    }
  }
});

// Also handle clicks on the editor container
const editorContainer = document.querySelector(
  ".editor-container"
) as HTMLElement;
editorContainer?.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target === editorContainer) {
    editor.focus();
    // Trigger the editor's mousedown logic
    const lastLine = editor.lastChild as HTMLElement;
    if (lastLine) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStart(lastLine, lastLine.childNodes.length || 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      state.currentLine = editor.childNodes.length - 1;
      handleCursorChange();
    }
  }
});

editor.addEventListener("focus", () => {
  state.editMode = true;
});

editor.addEventListener("blur", () => {
  // Save current line's data before blurring
  if (state.currentLine !== null && state.currentLine < editor.childNodes.length) {
    const currentLineDiv = editor.childNodes[state.currentLine] as HTMLElement;
    if (currentLineDiv) {
      const currentText = currentLineDiv.textContent || "";
      currentLineDiv.setAttribute("data-raw", currentText);
    }
  }

  state.editMode = false;
  state.currentLine = null;
  renderAllLines();
});

async function handleCursorChange() {
  // If there's an active selection (e.g., from Ctrl+A), don't interfere with it
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    // There's a selection, just update the cursor position display and return
    updateCursorPosition();
    return;
  }

  const lineNum = getCurrentLineNumber();

  if (lineNum !== state.currentLine) {
    const oldLine = state.currentLine;
    state.currentLine = lineNum;

    // Get all lines for code block detection
    const allLines = getAllLines();

    // Re-render the old line if it exists
    if (oldLine !== null && oldLine < editor.childNodes.length) {
      const oldLineDiv = editor.childNodes[oldLine] as HTMLElement;
      if (oldLineDiv) {
        // Only update data-raw if the line was actually being edited
        // This prevents corrupting data-raw when clicking through non-edited lines
        // (e.g., math blocks would have rendered KaTeX as textContent, not original LaTeX)
        if (oldLineDiv.classList.contains("editing")) {
          const currentText = oldLineDiv.textContent || "";
          oldLineDiv.setAttribute("data-raw", currentText);
          // Update allLines to reflect the change
          allLines[oldLine] = currentText;
        }

        const rawText = oldLineDiv.getAttribute("data-raw") || "";
        const html = await renderMarkdownLine(rawText, false, oldLine, allLines);
        oldLineDiv.innerHTML = html;
        oldLineDiv.classList.remove("editing");
      }
    }

    // Update current line to show raw
    const currentLineDiv = editor.childNodes[lineNum] as HTMLElement;
    if (currentLineDiv) {
      const rawText = currentLineDiv.getAttribute("data-raw") || "";

      // Save cursor position before modifying innerHTML
      const selection = window.getSelection();
      let cursorOffset = 0;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(currentLineDiv);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorOffset = preCaretRange.toString().length;
      }

      // Update the line to show raw markdown
      const html = await renderMarkdownLine(rawText, true, lineNum, allLines);
      currentLineDiv.innerHTML = html;
      currentLineDiv.classList.add("editing");

      // Restore cursor position
      try {
        const textNode = currentLineDiv.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          const newRange = document.createRange();
          const newSelection = window.getSelection();
          const offset = Math.min(cursorOffset, textNode.textContent?.length || 0);
          newRange.setStart(textNode, offset);
          newRange.collapse(true);
          newSelection?.removeAllRanges();
          newSelection?.addRange(newRange);
        }
      } catch (e) {
        // Cursor restoration failed, cursor will be at start
      }
    }
  }

  updateCursorPosition();
}

// Handle Enter key - create new line and split at cursor
editor.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentLineNum = getCurrentLineNumber();
    const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

    if (!currentLine) return;

    // Get the current raw text from textContent to ensure we have the latest edits
    const currentRawText = currentLine.textContent || "";

    // Find cursor position in the text
    let cursorPos = 0;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(currentLine);
    preRange.setEnd(range.startContainer, range.startOffset);
    cursorPos = preRange.toString().length;

    // Split the text at cursor position
    const beforeCursor = currentRawText.substring(0, cursorPos);
    const afterCursor = currentRawText.substring(cursorPos);

    // Update current line with text before cursor
    currentLine.setAttribute("data-raw", beforeCursor);

    // Create new line with text after cursor
    const newLine = document.createElement("div");
    newLine.className = "editor-line";
    newLine.setAttribute("data-raw", afterCursor);
    newLine.setAttribute("data-line", String(currentLineNum + 1));

    // Insert after current line
    if (currentLine.nextSibling) {
      editor.insertBefore(newLine, currentLine.nextSibling);
    } else {
      editor.appendChild(newLine);
    }

    // Update line numbers for subsequent lines
    for (let i = currentLineNum + 2; i < editor.childNodes.length; i++) {
      const line = editor.childNodes[i] as HTMLElement;
      line.setAttribute("data-line", String(i));
    }

    // Re-render affected lines (from current line onwards)
    const allLines = getAllLines();
    const requests: RenderRequest[] = [];
    for (let i = currentLineNum; i < editor.childNodes.length; i++) {
      const lineDiv = editor.childNodes[i] as HTMLElement;
      const rawText = lineDiv.getAttribute("data-raw") || "";
      const isEditing = i === currentLineNum + 1; // New line is in edit mode
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
    markDirty();
  }

  // Handle Backspace - merge with previous line if at start
  if (e.key === "Backspace") {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentLineNum = getCurrentLineNumber();
    const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

    if (!currentLine || currentLineNum === 0) return;

    // Check if cursor is at the start of the line
    const preRange = range.cloneRange();
    preRange.selectNodeContents(currentLine);
    preRange.setEnd(range.startContainer, range.startOffset);
    const cursorPos = preRange.toString().length;

    if (cursorPos === 0 && range.collapsed) {
      // At the start of the line - merge with previous line
      e.preventDefault();

      const prevLine = editor.childNodes[currentLineNum - 1] as HTMLElement;
      if (!prevLine) return;

      const prevText = prevLine.getAttribute("data-raw") || "";
      const currentText = currentLine.getAttribute("data-raw") || "";
      const mergePoint = prevText.length;
      const mergedText = prevText + currentText;

      // Update previous line with merged text
      prevLine.setAttribute("data-raw", mergedText);

      // Remove current line
      editor.removeChild(currentLine);

      // Update line numbers for subsequent lines
      for (let i = currentLineNum; i < editor.childNodes.length; i++) {
        const line = editor.childNodes[i] as HTMLElement;
        line.setAttribute("data-line", String(i));
      }

      // Re-render affected lines (from previous line onwards)
      const allLines = getAllLines();
      const requests: RenderRequest[] = [];
      for (let i = currentLineNum - 1; i < editor.childNodes.length; i++) {
        const lineDiv = editor.childNodes[i] as HTMLElement;
        const rawText = lineDiv.getAttribute("data-raw") || "";
        const isEditing = i === currentLineNum - 1; // Previous line (now merged) is in edit mode
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

      // Move cursor to merge point in previous line
      const textNode = prevLine.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const newRange = document.createRange();
        const newSelection = window.getSelection();
        const offset = Math.min(mergePoint, textNode.textContent?.length || 0);
        newRange.setStart(textNode, offset);
        newRange.collapse(true);
        newSelection?.removeAllRanges();
        newSelection?.addRange(newRange);
      }

      // Update state
      state.currentLine = currentLineNum - 1;
      state.content = getEditorContent();
      updateStatistics(state.content);
      markDirty();
    }
  }

  // Handle Delete - merge with next line if at end
  if (e.key === "Delete") {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentLineNum = getCurrentLineNumber();
    const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

    if (!currentLine) return;

    // Check if cursor is at the end of the line
    const currentText = currentLine.textContent || "";
    const preRange = range.cloneRange();
    preRange.selectNodeContents(currentLine);
    preRange.setEnd(range.startContainer, range.startOffset);
    const cursorPos = preRange.toString().length;

    if (cursorPos === currentText.length && range.collapsed) {
      // At the end of the line - merge with next line
      const nextLine = editor.childNodes[currentLineNum + 1] as HTMLElement;
      if (!nextLine) return;

      e.preventDefault();

      const currentRawText = currentLine.getAttribute("data-raw") || "";
      const nextText = nextLine.getAttribute("data-raw") || "";
      const mergedText = currentRawText + nextText;

      // Update current line with merged text
      currentLine.setAttribute("data-raw", mergedText);

      // Remove next line
      editor.removeChild(nextLine);

      // Update line numbers for subsequent lines
      for (let i = currentLineNum + 1; i < editor.childNodes.length; i++) {
        const line = editor.childNodes[i] as HTMLElement;
        line.setAttribute("data-line", String(i));
      }

      // Re-render affected lines (from current line onwards)
      const allLines = getAllLines();
      const requests: RenderRequest[] = [];
      for (let i = currentLineNum; i < editor.childNodes.length; i++) {
        const lineDiv = editor.childNodes[i] as HTMLElement;
        const rawText = lineDiv.getAttribute("data-raw") || "";
        const isEditing = i === currentLineNum; // Current line (now merged) is in edit mode
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

  // Handle Tab key
  if (e.key === "Tab") {
    e.preventDefault();
    document.execCommand("insertText", false, "  ");
  }
});

// Update statistics
function updateStatistics(text: string): void {
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;

  wordCountDisplay.textContent = `${words} word${words !== 1 ? "s" : ""}`;
  charCountDisplay.textContent = `${chars} character${chars !== 1 ? "s" : ""}`;
}

// Update cursor position
function updateCursorPosition(): void {
  const lineNum = getCurrentLineNumber();
  const line = lineNum + 1;

  const selection = window.getSelection();
  let col = 1;

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    const lineDiv = editor.childNodes[lineNum] as HTMLElement;

    if (lineDiv) {
      preCaretRange.selectNodeContents(lineDiv);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      col = preCaretRange.toString().length + 1;
    }
  }

  cursorPositionDisplay.textContent = `Ln ${line}, Col ${col}`;
}

// Mark document as dirty
function markDirty(): void {
  if (!state.isDirty) {
    state.isDirty = true;
    updateTitle();
  }
}

// Update title display
function updateTitle(): void {
  const fileName = state.currentFile
    ? state.currentFile.split(/[\\/]/).pop() || "Untitled.md"
    : "Untitled.md";
  fileNameDisplay.textContent = state.isDirty ? `${fileName} •` : fileName;
}

// Edit mode toggle
editModeToggle.addEventListener("click", () => {
  state.editMode = !state.editMode;

  if (state.editMode) {
    editor.focus();
  } else {
    state.currentLine = null;
    renderAllLines();
  }
});

// New file
document.getElementById("new-file")?.addEventListener("click", async () => {
  if (state.isDirty) {
    const shouldSave = confirm(
      "You have unsaved changes. Do you want to save them?"
    );
    if (shouldSave) {
      await saveFile();
    }
  }

  // Blur editor to exit edit mode
  editor.blur();
  state.editMode = false;
  state.currentLine = null;

  // Set empty content
  setEditorContent("");
  state.content = "";
  state.currentFile = null;
  state.isDirty = false;

  // Update UI
  updateStatistics("");
  updateTitle();

  // Don't auto-focus - let user click when ready
});

// Open file
document.getElementById("open-file")?.addEventListener("click", async () => {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Markdown",
          extensions: ["md", "markdown", "txt"],
        },
      ],
    });

    if (selected && typeof selected === "string") {
      const content = await readTextFile(selected);

      // Completely reset state
      state.editMode = false;
      state.currentLine = null;

      // Remove focus from editor
      editor.blur();

      // Clear editor completely
      editor.innerHTML = "";

      // Split content into lines, handling both Unix and Windows line endings
      const lines = content.split(/\r?\n/).map((line: string) => line.trimEnd());

      // Create requests for batch rendering
      const requests: RenderRequest[] = lines.map((line: string, index: number) => ({
        line,
        line_index: index,
        all_lines: lines,
        is_editing: false,
      }));

      // Batch render all lines
      const results = await renderMarkdownBatch(requests);

      // Use DocumentFragment for efficient DOM operations (single reflow)
      const fragment = document.createDocumentFragment();

      results.forEach((result, index) => {
        const lineDiv = document.createElement("div");
        lineDiv.className = "editor-line";
        lineDiv.setAttribute("data-raw", lines[index]);
        lineDiv.setAttribute("data-line", String(index));
        lineDiv.innerHTML = result.html;
        lineDiv.classList.remove("editing");
        fragment.appendChild(lineDiv);
      });

      // Single DOM append (much faster than individual appends)
      editor.appendChild(fragment);

      // Update state
      state.content = content;
      state.currentFile = selected;
      state.isDirty = false;

      // Update UI
      updateStatistics(content);
      updateTitle();

      console.log("File loaded, lines rendered:", lines.length);
    }
  } catch (error) {
    console.error("Error opening file:", error);
    alert("Failed to open file");
  }
});

// Save file
async function saveFile(): Promise<void> {
  try {
    if (state.currentFile) {
      await writeTextFile(state.currentFile, state.content);
      state.isDirty = false;
      updateTitle();
    } else {
      await saveFileAs();
    }
  } catch (error) {
    console.error("Error saving file:", error);
    alert("Failed to save file");
  }
}

// Save file as
async function saveFileAs(): Promise<void> {
  try {
    const filePath = await save({
      filters: [
        {
          name: "Markdown",
          extensions: ["md"],
        },
      ],
      defaultPath: "Untitled.md",
    });

    if (filePath) {
      await writeTextFile(filePath, state.content);
      state.currentFile = filePath;
      state.isDirty = false;
      updateTitle();
    }
  } catch (error) {
    console.error("Error saving file:", error);
    alert("Failed to save file");
  }
}

document.getElementById("save-file")?.addEventListener("click", saveFile);

// Keyboard shortcuts
document.addEventListener("keydown", async (e) => {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    await saveFile();
  }

  // Ctrl/Cmd + N to new file
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    document.getElementById("new-file")?.click();
  }

  // Ctrl/Cmd + O to open file
  if ((e.ctrlKey || e.metaKey) && e.key === "o") {
    e.preventDefault();
    document.getElementById("open-file")?.click();
  }
});

// Before unload
window.addEventListener("beforeunload", (e) => {
  if (state.isDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// Initialize
(async () => {
  const initialContent = "# Welcome to Markdown Editor\n\nStart typing...";
  const initialLines = initialContent.split(/\r?\n/).map((line: string) => line.trimEnd());

  // Create requests for batch rendering
  const requests: RenderRequest[] = initialLines.map((line, index) => ({
    line,
    line_index: index,
    all_lines: initialLines,
    is_editing: false,
  }));

  // Batch render all lines
  const results = await renderMarkdownBatch(requests);

  // Use DocumentFragment for efficient DOM operations (single reflow)
  const fragment = document.createDocumentFragment();

  results.forEach((result, index) => {
    const lineDiv = document.createElement("div");
    lineDiv.className = "editor-line";
    lineDiv.setAttribute("data-raw", initialLines[index]);
    lineDiv.setAttribute("data-line", String(index));
    lineDiv.innerHTML = result.html;
    lineDiv.classList.remove("editing");
    fragment.appendChild(lineDiv);
  });

  // Single DOM append (much faster than individual appends)
  editor.appendChild(fragment);

  state.content = initialContent;
  updateStatistics(state.content);
  updateCursorPosition();
  state.editMode = false;
  state.currentLine = null;
})();
