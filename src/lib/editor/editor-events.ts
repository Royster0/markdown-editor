/**
 * Editor event handlers
 * Handles input, cursor changes, and event initialization
 */

import { editor, editModeToggle, editorContainer } from "../core/dom";
import { state } from "../core/state";
import {
  renderMarkdownLine,
  renderAllLines,
  getAllLines,
  getEditorContent,
} from "./rendering";
import { updateStatistics, updateCursorPosition, getCurrentLineNumber } from "../ui/ui";
import { saveFile } from "../file-operations";
import { markCurrentTabDirty, updateCurrentTabContent, closeActiveTab } from "../tabs/tabs";
import { getFirstTextNode, isLineInsideBlock } from "./editor-utils";
import { handleEnterKey, handleBackspaceKey, handleDeleteKey, handleTabKey } from "./editor-keys";

/**
 * Handle cursor changes (moving between lines)
 */
export async function handleCursorChange() {
  // If there's an active selection, don't interfere with it
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
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
        // Only update data-raw if the line was actually being edited AND it's safe to do so
        if (oldLineDiv.classList.contains("editing")) {
          const innerHTML = oldLineDiv.innerHTML;
          const hasSpecialClass =
            innerHTML.includes("code-block-line-editing") ||
            innerHTML.includes("math-block-line-editing") ||
            innerHTML.includes("math-block-line") ||
            innerHTML.includes('class="math-block-start"') ||
            innerHTML.includes('class="math-block-end"') ||
            innerHTML.includes('class="code-block-start"') ||
            innerHTML.includes('class="code-block-end"');

          const insideBlock = isLineInsideBlock(oldLine, allLines);
          const isSpecialBlock = hasSpecialClass || insideBlock;

          if (!isSpecialBlock) {
            const currentText = oldLineDiv.textContent || "";
            oldLineDiv.setAttribute("data-raw", currentText);
            allLines[oldLine] = currentText;
          }
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

      // Use requestAnimationFrame to ensure DOM layout is complete
      requestAnimationFrame(() => {
        try {
          const textNode = getFirstTextNode(currentLineDiv);
          if (
            textNode &&
            textNode.nodeType === Node.TEXT_NODE &&
            textNode.textContent
          ) {
            const newRange = document.createRange();
            const newSelection = window.getSelection();
            const offset = Math.min(cursorOffset, textNode.textContent.length);
            newRange.setStart(textNode, offset);
            newRange.collapse(true);
            newSelection?.removeAllRanges();
            newSelection?.addRange(newRange);
          } else {
            editor.focus();
          }
        } catch (e) {
          console.error("Cursor restoration failed:", e);
          editor.focus();
        }
      });
    }
  }

  updateCursorPosition();
}

/**
 * Handle input events in the editor
 */
export async function handleInput() {
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

    // Re-render the line with editing mode
    const allLines = getAllLines();
    const html = await renderMarkdownLine(
      rawText,
      true,
      currentLineNum,
      allLines
    );
    lineDiv.innerHTML = html;

    // Restore cursor position
    try {
      const textNode = lineDiv.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const newRange = document.createRange();
        const newSelection = window.getSelection();
        const offset = Math.min(
          cursorOffset,
          textNode.textContent?.length || 0
        );
        newRange.setStart(textNode, offset);
        newRange.collapse(true);
        newSelection?.removeAllRanges();
        newSelection?.addRange(newRange);
      } else if (lineDiv.childNodes.length > 0) {
        // Handle complex nodes
        const newRange = document.createRange();
        const newSelection = window.getSelection();

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
      console.warn("Failed to restore cursor position:", e);
    }
  }

  state.content = getEditorContent();
  updateStatistics(state.content);
  updateCurrentTabContent(state.content);
  markCurrentTabDirty();
}

/**
 * Initialize all editor event listeners
 */
export function initEditorEvents() {
  // Input event
  editor.addEventListener("input", handleInput);

  // Cursor movement
  editor.addEventListener("click", handleCursorChange);
  editor.addEventListener("keyup", handleCursorChange);

  // Focus - put cursor at end if clicking in empty space
  editor.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement;

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

        state.currentLine = editor.childNodes.length - 1;
        handleCursorChange();
      }
    }
  });

  // Editor container clicks
  editorContainer?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target === editorContainer) {
      editor.focus();
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

  // Focus and blur
  editor.addEventListener("focus", () => {
    state.editMode = true;
  });

  editor.addEventListener("blur", () => {
    // Save current line's data before blurring
    if (
      state.currentLine !== null &&
      state.currentLine < editor.childNodes.length
    ) {
      const currentLineDiv = editor.childNodes[state.currentLine] as HTMLElement;
      if (currentLineDiv) {
        const currentText = currentLineDiv.textContent || "";
        currentLineDiv.setAttribute("data-raw", currentText);
      }
    }

    state.editMode = false;
    state.currentLine = null;
    renderAllLines(state.currentLine, state.editMode);
  });

  // Keyboard events
  editor.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      await handleEnterKey(e);
    } else if (e.key === "Backspace") {
      await handleBackspaceKey(e);
    } else if (e.key === "Delete") {
      await handleDeleteKey(e);
    } else if (e.key === "Tab") {
      handleTabKey(e);
    }
  });

  // Edit mode toggle
  editModeToggle.addEventListener("click", () => {
    state.editMode = !state.editMode;

    if (state.editMode) {
      editor.focus();
    } else {
      state.currentLine = null;
      renderAllLines(state.currentLine, state.editMode);
    }
  });

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

    // Ctrl/Cmd + W to close tab
    if ((e.ctrlKey || e.metaKey) && e.key === "w") {
      e.preventDefault();
      await closeActiveTab();
    }
  });

  // Before unload
  window.addEventListener("beforeunload", (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}
