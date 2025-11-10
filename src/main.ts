/**
 * Markdown Editor - Main Entry Point
 *
 * This is a modular markdown editor built with TypeScript, Tauri, and Rust.
 * The application provides live markdown preview with LaTeX support.
 */

import "./lib/types";
import { state } from "./lib/state";
import { updateStatistics, updateCursorPosition } from "./lib/ui";
import { renderMarkdownBatch } from "./lib/rendering";
import { initEditorEvents } from "./lib/editor";
import { initWindowControls } from "./lib/window-controls";
import type { RenderRequest } from "./lib/types";

/**
 * Initialize the application
 */
async function initialize() {
  // Set initial content
  const initialContent = "# Welcome to Markdown Editor\n\nStart typing...";
  const initialLines = initialContent
    .split(/\r?\n/)
    .map((line: string) => line.trimEnd());

  // Create requests for batch rendering
  const requests: RenderRequest[] = initialLines.map((line, index) => ({
    line,
    line_index: index,
    all_lines: initialLines,
    is_editing: false,
  }));

  // Batch render all lines
  const results = await renderMarkdownBatch(requests);

  // Get editor element
  const editor = document.getElementById("editor") as HTMLDivElement;

  // Use DocumentFragment for efficient DOM operations
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

  // Single DOM append
  editor.appendChild(fragment);

  // Initialize state
  state.content = initialContent;
  state.editMode = false;
  state.currentLine = null;

  // Initialize UI
  updateStatistics(state.content);
  updateCursorPosition();

  // Initialize event handlers
  initEditorEvents();
  initWindowControls();

  console.log("Markdown Editor initialized successfully");
}

// Start the application
initialize().catch((error) => {
  console.error("Failed to initialize application:", error);
});
