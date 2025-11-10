import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { marked } from "marked";
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

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

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

// Check if a line index is inside a code block
function isInCodeBlock(lineIndex: number, allLines: string[]): { inBlock: boolean; isStart: boolean; isEnd: boolean } {
  let inBlock = false;
  for (let i = 0; i <= lineIndex; i++) {
    const line = allLines[i];
    if (line && line.trim().startsWith("```")) {
      if (i === lineIndex) {
        // This line is a code block boundary
        return { inBlock: true, isStart: !inBlock, isEnd: inBlock };
      }
      inBlock = !inBlock;
    }
  }

  return { inBlock, isStart: false, isEnd: false };
}

// Convert markdown line to HTML with styling
function renderMarkdownLine(line: string, isEditing: boolean, lineIndex?: number, allLines?: string[]): string {
  if (isEditing) {
    // Show raw markdown when editing
    return escapeHtml(line);
  }

  // Check if this line is part of a code block
  if (lineIndex !== undefined && allLines && allLines.length > 0) {
    const codeBlockInfo = isInCodeBlock(lineIndex, allLines);

    if (codeBlockInfo.isStart) {
      // Starting ``` line - extract language if present
      const langMatch = line.trim().match(/^```(\w+)?/);
      const lang = langMatch && langMatch[1] ? langMatch[1] : '';
      return `<span class="code-block-start" data-lang="${lang}"></span>`;
    }

    if (codeBlockInfo.isEnd) {
      // Ending ``` line
      return '<span class="code-block-end"></span>';
    }

    if (codeBlockInfo.inBlock) {
      // Inside code block - show as escaped code
      return `<code class="code-block-line">${escapeHtml(line)}</code>`;
    }
  }

  // Empty line
  if (line.trim() === "") {
    return "<br>";
  }

  // Horizontal rule - check early before other patterns
  if (line.match(/^(---+|\*\*\*+|___+)$/)) {
    return '<span class="hr">───────────────────────────────────────</span>';
  }

  // Headers - identify structure first, then process content
  if (line.match(/^(#{1,6})\s+(.+)$/)) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2];
      // Process inline markdown (which now includes LaTeX) on header text
      const processedText = renderInlineMarkdown(text);
      return `<span class="heading h${level}">${processedText}</span>`;
    }
  }

  // List items - identify structure first, then process content
  if (line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/)) {
    const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (match) {
      const indent = match[1].length;
      const marker = match[2];
      const text = match[3];
      const isOrdered = /^\d+\./.test(marker);
      return `<span class="list-item" style="padding-left: ${indent * 20}px">
        <span class="list-marker ${
          isOrdered ? "ordered" : "unordered"
        }">${marker}</span>
        ${renderInlineMarkdown(text)}
      </span>`;
    }
  }

  // Blockquote - identify structure first, then process content
  if (line.match(/^>\s*(.+)$/)) {
    const match = line.match(/^>\s*(.+)$/);
    if (match) {
      return `<span class="blockquote">${renderInlineMarkdown(
        match[1]
      )}</span>`;
    }
  }

  // For regular paragraphs, process inline markdown (includes LaTeX)
  return renderInlineMarkdown(line) || "<br>";
}

// Render inline markdown (for parts of lines) including LaTeX
function renderInlineMarkdown(text: string): string {
  // Process LaTeX first
  text = renderLatex(text);

  // Bold + Italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  text = text.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough
  text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Inline code
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links
  text = text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');

  return text;
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
function setEditorContent(text: string) {
  // Split on both Unix (\n) and Windows (\r\n) line endings
  const lines = text.split(/\r?\n/).map((line: string) => line.trimEnd());
  editor.innerHTML = "";

  lines.forEach((line: string, index: number) => {
    const lineDiv = document.createElement("div");
    lineDiv.className = "editor-line";
    lineDiv.setAttribute("data-raw", line);
    lineDiv.setAttribute("data-line", String(index));
    lineDiv.innerHTML = renderMarkdownLine(line, false, index, lines);
    editor.appendChild(lineDiv);
  });
}

// Update a specific line (currently unused, but kept for potential future use)
// function updateLine(lineIndex: number, rawText: string, isEditing: boolean) {
//   const lineDiv = editor.childNodes[lineIndex] as HTMLElement;
//   if (lineDiv) {
//     lineDiv.setAttribute("data-raw", rawText);
//     lineDiv.innerHTML = renderMarkdownLine(rawText, isEditing);
//   }
// }

// Render all lines
function renderAllLines() {
  const allLines = getAllLines();
  for (let i = 0; i < editor.childNodes.length; i++) {
    const lineDiv = editor.childNodes[i] as HTMLElement;
    const rawText = lineDiv.getAttribute("data-raw") || "";
    const isCurrentLine = i === state.currentLine && state.editMode;
    lineDiv.innerHTML = renderMarkdownLine(rawText, isCurrentLine, i, allLines);

    if (isCurrentLine) {
      lineDiv.classList.add("editing");
    } else {
      lineDiv.classList.remove("editing");
    }
  }
}

// Save cursor position (currently unused, kept for reference)
// function saveCursorPosition() {
//   const selection = window.getSelection();
//   if (!selection || selection.rangeCount === 0) return null;
//
//   const range = selection.getRangeAt(0);
//   return {
//     startContainer: range.startContainer,
//     startOffset: range.startOffset,
//   };
// }
//
// // Restore cursor position
// function restoreCursorPosition(position: any) {
//   if (!position) return;
//
//   const selection = window.getSelection();
//   const range = document.createRange();
//
//   try {
//     range.setStart(position.startContainer, position.startOffset);
//     range.collapse(true);
//     selection?.removeAllRanges();
//     selection?.addRange(range);
//   } catch (e) {
//     // Cursor position no longer valid
//   }
// }

// Handle input
editor.addEventListener("input", () => {
  const currentLineNum = getCurrentLineNumber();
  const lineDiv = editor.childNodes[currentLineNum] as HTMLElement;

  if (lineDiv) {
    const rawText = lineDiv.textContent || "";
    lineDiv.setAttribute("data-raw", rawText);
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

function handleCursorChange() {
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
        // IMPORTANT: Update data-raw with the current text content before re-rendering
        // This ensures any edits made to the line are preserved
        const currentText = oldLineDiv.textContent || "";
        oldLineDiv.setAttribute("data-raw", currentText);
        // Update allLines to reflect the change
        allLines[oldLine] = currentText;
        oldLineDiv.innerHTML = renderMarkdownLine(currentText, false, oldLine, allLines);
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
      currentLineDiv.innerHTML = renderMarkdownLine(rawText, true, lineNum, allLines);
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
editor.addEventListener("keydown", (e) => {
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
    for (let i = currentLineNum; i < editor.childNodes.length; i++) {
      const lineDiv = editor.childNodes[i] as HTMLElement;
      const rawText = lineDiv.getAttribute("data-raw") || "";
      const isEditing = i === currentLineNum + 1; // New line is in edit mode
      lineDiv.innerHTML = renderMarkdownLine(rawText, isEditing, i, allLines);
      if (isEditing) {
        lineDiv.classList.add("editing");
      } else {
        lineDiv.classList.remove("editing");
      }
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
      for (let i = currentLineNum - 1; i < editor.childNodes.length; i++) {
        const lineDiv = editor.childNodes[i] as HTMLElement;
        const rawText = lineDiv.getAttribute("data-raw") || "";
        const isEditing = i === currentLineNum - 1; // Previous line (now merged) is in edit mode
        lineDiv.innerHTML = renderMarkdownLine(rawText, isEditing, i, allLines);
        if (isEditing) {
          lineDiv.classList.add("editing");
        } else {
          lineDiv.classList.remove("editing");
        }
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
      for (let i = currentLineNum; i < editor.childNodes.length; i++) {
        const lineDiv = editor.childNodes[i] as HTMLElement;
        const rawText = lineDiv.getAttribute("data-raw") || "";
        const isEditing = i === currentLineNum; // Current line (now merged) is in edit mode
        lineDiv.innerHTML = renderMarkdownLine(rawText, isEditing, i, allLines);
        if (isEditing) {
          lineDiv.classList.add("editing");
        } else {
          lineDiv.classList.remove("editing");
        }
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

      // Create and render each line properly
      lines.forEach((line: string, index: number) => {
        const lineDiv = document.createElement("div");
        lineDiv.className = "editor-line";
        lineDiv.setAttribute("data-raw", line);
        lineDiv.setAttribute("data-line", String(index));

        // Render the line with isEditing = false to show styled content
        const renderedContent = renderMarkdownLine(line, false, index, lines);
        lineDiv.innerHTML = renderedContent;

        // Make sure it's not marked as editing
        lineDiv.classList.remove("editing");

        editor.appendChild(lineDiv);
      });

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
const initialContent = "# Welcome to Markdown Editor\n\nStart typing...";
const initialLines = initialContent.split(/\r?\n/).map((line: string) => line.trimEnd());

initialLines.forEach((line: string, index: number) => {
  const lineDiv = document.createElement("div");
  lineDiv.className = "editor-line";
  lineDiv.setAttribute("data-raw", line);
  lineDiv.setAttribute("data-line", String(index));
  lineDiv.innerHTML = renderMarkdownLine(line, false, index, initialLines);
  lineDiv.classList.remove("editing");
  editor.appendChild(lineDiv);
});

state.content = initialContent;
updateStatistics(state.content);
updateCursorPosition();
state.editMode = false;
state.currentLine = null;
