/**
 * Markdown formatting operations
 * Markdown-specific text formatting and structure
 */

import { editor } from "../core/dom";
import { handleInput } from "../editor/editor-events";
import { getCurrentLineNumber } from "../ui/ui";
import { getSelectionInfo, insertOrWrapText } from "./text-editing-utils";

/**
 * Toggle bold formatting
 */
export function toggleBold() {
  insertOrWrapText("**", "**", "bold text");
}

/**
 * Toggle italic formatting
 */
export function toggleItalic() {
  insertOrWrapText("*", "*", "italic text");
}

/**
 * Toggle strikethrough formatting
 */
export function toggleStrikethrough() {
  insertOrWrapText("~~", "~~", "strikethrough text");
}

/**
 * Insert a link
 */
export function insertLink() {
  const info = getSelectionInfo();
  if (!info) return;

  const { range, selectedText } = info;

  if (selectedText) {
    // Wrap selected text as link text
    const linkText = `[${selectedText}](url)`;
    range.deleteContents();
    range.insertNode(document.createTextNode(linkText));
  } else {
    // Insert link template
    const linkText = "[link text](url)";
    range.insertNode(document.createTextNode(linkText));
  }

  handleInput();
}

/**
 * Insert inline code
 */
export function insertCode() {
  insertOrWrapText("`", "`", "code");
}

/**
 * Insert code block
 */
export function insertCodeBlock() {
  const currentLineNum = getCurrentLineNumber();
  const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

  if (!currentLine) return;

  const rawText = currentLine.getAttribute("data-raw") || "";

  // Insert code block on a new line
  if (rawText.trim() === "") {
    currentLine.setAttribute("data-raw", "```");
    currentLine.textContent = "```";

    // Create new line for code content
    const codeLine = document.createElement("div");
    codeLine.className = "editor-line";
    codeLine.setAttribute("data-raw", "");
    codeLine.setAttribute("data-line", String(currentLineNum + 1));
    codeLine.textContent = "";

    // Create closing line
    const closeLine = document.createElement("div");
    closeLine.className = "editor-line";
    closeLine.setAttribute("data-raw", "```");
    closeLine.setAttribute("data-line", String(currentLineNum + 2));
    closeLine.textContent = "```";

    // Insert after current line
    if (currentLine.nextSibling) {
      editor.insertBefore(closeLine, currentLine.nextSibling);
      editor.insertBefore(codeLine, closeLine);
    } else {
      editor.appendChild(codeLine);
      editor.appendChild(closeLine);
    }

    // Update line numbers for lines after
    for (let i = currentLineNum + 3; i < editor.childNodes.length; i++) {
      const line = editor.childNodes[i] as HTMLElement;
      line.setAttribute("data-line", String(i));
    }

    // Focus on the code line
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(codeLine, 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  handleInput();
}

/**
 * Increase heading level (make heading smaller number, e.g., ## -> #)
 */
export function increaseHeadingLevel() {
  const currentLineNum = getCurrentLineNumber();
  const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

  if (!currentLine) return;

  const rawText = currentLine.getAttribute("data-raw") || "";
  const match = rawText.match(/^(#{1,5})\s/);

  if (match) {
    // Already a heading, decrease the number of #'s (increase level)
    const currentHashes = match[1];
    const newText = rawText.replace(/^#{1,5}\s/, currentHashes.slice(0, -1) + " ");
    currentLine.setAttribute("data-raw", newText);
    currentLine.textContent = newText;
  } else if (rawText.match(/^#{6}\s/)) {
    // Already at h6, go to h5
    const newText = rawText.replace(/^#{6}\s/, "##### ");
    currentLine.setAttribute("data-raw", newText);
    currentLine.textContent = newText;
  } else {
    // Not a heading, make it h1
    const newText = "# " + rawText;
    currentLine.setAttribute("data-raw", newText);
    currentLine.textContent = newText;
  }

  handleInput();
}

/**
 * Decrease heading level (make heading larger number, e.g., # -> ##)
 */
export function decreaseHeadingLevel() {
  const currentLineNum = getCurrentLineNumber();
  const currentLine = editor.childNodes[currentLineNum] as HTMLElement;

  if (!currentLine) return;

  const rawText = currentLine.getAttribute("data-raw") || "";
  const match = rawText.match(/^(#{1,5})\s/);

  if (match) {
    // Already a heading, increase the number of #'s (decrease level)
    const currentHashes = match[1];
    if (currentHashes.length < 6) {
      const newText = rawText.replace(/^#{1,5}\s/, currentHashes + "# ");
      currentLine.setAttribute("data-raw", newText);
      currentLine.textContent = newText;
    }
  } else {
    // Not a heading, make it h1
    const newText = "# " + rawText;
    currentLine.setAttribute("data-raw", newText);
    currentLine.textContent = newText;
  }

  handleInput();
}
