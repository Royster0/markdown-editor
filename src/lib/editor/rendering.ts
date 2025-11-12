/**
 * Markdown rendering functions
 *
 * This module handles rendering markdown to HTML using the Rust backend
 * and KaTeX for LaTeX math rendering on the frontend.
 */

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import katex from "katex";
import { RenderRequest, LineRenderResult } from "../core/types";
import { editor } from "../core/dom";

/**
 * Escape HTML entities
 * @param text - The text to escape
 * @returns HTML-escaped text
 */
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Parse and render LaTeX expressions in text
 * @param text - Text containing LaTeX expressions
 * @returns Text with LaTeX rendered as HTML
 */
export function renderLatex(text: string): string {
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

/**
 * Convert image file paths to Tauri asset protocol URLs
 * @param html - HTML string containing img tags
 * @returns HTML with converted image paths
 */
export function convertImagePaths(html: string): string {
  // Quick check: if no img tag, skip processing
  if (!html.includes("<img")) {
    return html;
  }

  return html.replace(
    /<img([^>]*?)src="([^"]+)"([^>]*?)>/g,
    (match, before, src, after) => {
      try {
        // Skip if already using a URL protocol (must have :// after protocol name)
        // This properly distinguishes URLs from Windows paths like C:\
        if (src.match(/^[a-z][a-z0-9+.-]*:\/\//i)) {
          console.log(`Skipping URL with protocol: ${src}`);
          return match;
        }

        // Skip data URLs (they have : but no //)
        if (src.startsWith("data:")) {
          console.log(`Skipping data URL: ${src.substring(0, 50)}...`);
          return match;
        }

        // Convert file path to Tauri asset URL
        const assetUrl = convertFileSrc(src);
        console.log(`Converting image path: ${src} -> ${assetUrl}`);
        return `<img${before}src="${assetUrl}"${after}>`;
      } catch (e) {
        console.error("Error converting image path:", src, e);
        return match;
      }
    }
  );
}

/**
 * Post-process HTML to render LaTeX (frontend-only since we use KaTeX)
 * Optimized: only process if line contains LaTeX markers or is a math block
 * @param html - HTML string to process
 * @returns HTML with LaTeX rendered
 */
export function renderLatexInHtml(html: string): string {
  // Check for math block lines and render them with KaTeX in display mode
  if (html.includes('class="math-block-line"')) {
    return html.replace(
      /<span class="math-block-line">([\s\S]*?)<\/span>/g,
      (match, content) => {
        try {
          // Decode HTML entities
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          const latex = tempDiv.textContent || tempDiv.innerText || '';

          const rendered = katex.renderToString(latex.trim(), {
            displayMode: true,
            throwOnError: false,
          });
          return `<span class="math-block-line">${rendered}</span>`;
        } catch (e) {
          console.error("Error rendering LaTeX:", e);
          return match;
        }
      }
    );
  }

  // Quick check: if no $ symbol, skip LaTeX processing entirely
  if (!html.includes("$")) {
    return html;
  }
  return renderLatex(html);
}

/**
 * Convert a single markdown line to HTML using the Rust backend
 * @param line - The markdown line to render
 * @param isEditing - Whether the line is being edited
 * @param lineIndex - Optional line index for context
 * @param allLines - Optional array of all lines for context
 * @returns Rendered HTML string
 */
export async function renderMarkdownLine(
  line: string,
  isEditing: boolean,
  lineIndex?: number,
  allLines?: string[]
): Promise<string> {
  const safeLineIndex = lineIndex ?? 0;
  const safeAllLines = allLines ?? [line];

  const request: RenderRequest = {
    line,
    line_index: safeLineIndex,
    all_lines: safeAllLines,
    is_editing: isEditing,
  };

  try {
    const result = await invoke<LineRenderResult>("render_markdown", {
      request,
    });

    let html = result.html;

    // Convert image paths to Tauri asset URLs
    html = convertImagePaths(html);

    // Only render LaTeX when NOT editing to preserve the original $ markers
    if (isEditing) {
      return html;
    }

    return renderLatexInHtml(html);
  } catch (error) {
    console.error("Error rendering markdown:", error);
    return escapeHtml(line);
  }
}

/**
 * Batch render multiple markdown lines for better performance
 * @param requests - Array of render requests
 * @returns Array of render results
 */
export async function renderMarkdownBatch(
  requests: RenderRequest[]
): Promise<LineRenderResult[]> {
  try {
    const results = await invoke<LineRenderResult[]>("render_markdown_batch", {
      requests,
    });

    // Post-process all results to convert image paths and add LaTeX rendering
    return results.map((result: LineRenderResult, index: number) => {
      let html = convertImagePaths(result.html);

      // Only for non-editing lines, also render LaTeX
      if (!requests[index].is_editing) {
        html = renderLatexInHtml(html);
      }

      return {
        ...result,
        html,
      };
    });
  } catch (error) {
    console.error("Error batch rendering markdown:", error);
    return requests.map((req) => ({
      html: escapeHtml(req.line),
      is_code_block_boundary: false,
    }));
  }
}

/**
 * Get all raw line strings from editor
 * @returns Array of line strings
 */
export function getAllLines(): string[] {
  const lines: string[] = [];
  for (let i = 0; i < editor.childNodes.length; i++) {
    const node = editor.childNodes[i];
    if (node.nodeName === "DIV") {
      lines.push((node as HTMLElement).getAttribute("data-raw") || "");
    }
  }
  return lines;
}

/**
 * Get plain text content from editor
 * @returns Editor content as plain text
 */
export function getEditorContent(): string {
  return getAllLines().join("\n");
}

/**
 * Set editor content from plain text
 * @param text - Text content to set
 */
export async function setEditorContent(text: string) {
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

/**
 * Render all lines in the editor
 */
export async function renderAllLines(currentLine: number | null, editMode: boolean) {
  const allLines = getAllLines();

  // Create requests for batch rendering
  const requests: RenderRequest[] = allLines.map((line, i) => ({
    line,
    line_index: i,
    all_lines: allLines,
    is_editing: i === currentLine && editMode,
  }));

  // Batch render all lines
  const results = await renderMarkdownBatch(requests);

  // Update DOM
  for (let i = 0; i < editor.childNodes.length; i++) {
    const lineDiv = editor.childNodes[i] as HTMLElement;
    const isCurrentLine = i === currentLine && editMode;

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
