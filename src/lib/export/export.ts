/**
 * Export module
 * Handles exporting markdown files to various formats (HTML, PDF)
 */

import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { state } from "../core/state";
import { getAllLines, renderLatexInHtml } from "../editor/rendering";
import { RenderRequest, LineRenderResult } from "../core/types";

/**
 * Get KaTeX CSS for math rendering
 * @returns KaTeX CSS string
 */
function getKaTeXCSS(): string {
  return `
/* KaTeX styles */
.katex { font: normal 1.21em KaTeX_Main, Times New Roman, serif; line-height: 1.2; text-indent: 0; }
.katex * { -ms-high-contrast-adjust: none !important; border-color: currentColor; }
.katex .katex-html { display: inline-block; }
.katex .base { position: relative; white-space: nowrap; width: min-content; }
.katex .strut { display: inline-block; }
.katex .mord, .katex .mrel, .katex .mbin, .katex .mop, .katex .mopen, .katex .mclose, .katex .mpunct { display: inline; }
  `;
}

/**
 * Convert image src to base64 data URL for embedding in exported HTML
 * @param src - Image source path
 * @returns Base64 data URL or original src if conversion fails
 */
async function convertImageToDataUrl(src: string): Promise<string> {
  try {
    // Skip if already a URL protocol
    if (src.match(/^[a-z][a-z0-9+.-]*:\/\//i)) {
      return src;
    }

    // Skip if already a data URL
    if (src.startsWith("data:")) {
      return src;
    }

    // Determine image MIME type from extension
    const ext = src.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: { [key: string]: string } = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
    };
    const mimeType = mimeTypes[ext] || 'image/png';

    // Read the file as bytes
    const imageData = await readFile(src);

    // Convert to base64
    const base64 = btoa(
      Array.from(new Uint8Array(imageData))
        .map((byte: number) => String.fromCharCode(byte))
        .join('')
    );

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error converting image to data URL: ${src}`, error);
    return src; // Return original path if conversion fails
  }
}

/**
 * Convert all image paths in HTML to base64 data URLs
 * @param html - HTML string containing img tags
 * @returns HTML with embedded base64 images
 */
async function embedImagesAsBase64(html: string): Promise<string> {
  // Quick check: if no img tag, skip processing
  if (!html.includes("<img")) {
    return html;
  }

  // Extract all image src attributes
  const imgRegex = /<img([^>]*?)src="([^"]+)"([^>]*?)>/g;
  const matches = [...html.matchAll(imgRegex)];

  // Convert each image to base64
  for (const match of matches) {
    const [fullMatch, before, src, after] = match;
    const dataUrl = await convertImageToDataUrl(src);

    // Replace in HTML
    const newImg = `<img${before}src="${dataUrl}"${after}>`;
    html = html.replace(fullMatch, newImg);
  }

  return html;
}

/**
 * Render all markdown lines to HTML
 * @returns Array of rendered HTML strings
 */
async function renderAllLinesToHTML(): Promise<string[]> {
  const allLines = getAllLines();

  // Create requests for batch rendering
  const requests: RenderRequest[] = allLines.map((line, index) => ({
    line,
    line_index: index,
    all_lines: allLines,
    is_editing: false,
  }));

  try {
    const results = await invoke<LineRenderResult[]>("render_markdown_batch", {
      requests,
    });

    // Post-process each line: apply LaTeX rendering and embed images
    const processedLines = await Promise.all(
      results.map(async (result: LineRenderResult) => {
        // Apply LaTeX rendering (KaTeX on frontend)
        let html = renderLatexInHtml(result.html);

        // Embed images as base64 data URLs
        html = await embedImagesAsBase64(html);

        return html;
      })
    );

    return processedLines;
  } catch (error) {
    console.error("Error rendering markdown for export:", error);
    return allLines.map(line => `<p>${escapeHtml(line)}</p>`);
  }
}

/**
 * Escape HTML entities
 * @param text - The text to escape
 * @returns HTML-escaped text
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get the filename without extension
 * @returns Filename or "document"
 */
function getFileName(): string {
  if (state.currentFile) {
    const parts = state.currentFile.split(/[\\/]/);
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[^/.]+$/, ""); // Remove extension
  }
  return "document";
}

/**
 * Export current document to HTML
 */
export async function exportToHTML(): Promise<void> {
  try {
    if (!state.currentFile) {
      alert("Please open or save a file first before exporting.");
      return;
    }

    const filename = getFileName();
    const filePath = await save({
      defaultPath: `${filename}.html`,
      filters: [{
        name: "HTML",
        extensions: ["html"]
      }]
    });

    if (!filePath) {
      return; // User cancelled
    }

    // Get rendered HTML lines
    const renderedLines = await renderAllLinesToHTML();
    const content = renderedLines.join('\n');

    // Get CSS for styling
    const katexCSS = getKaTeXCSS();

    // Create complete HTML document
    const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">
  <style>
    ${katexCSS}

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background-color: #ffffff;
      color: #333333;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
    }

    h1 { font-size: 2em; border-bottom: 1px solid #eaeaea; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaeaea; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; color: #6a737d; }

    p { margin-bottom: 1em; }

    a {
      color: #0366d6;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      background-color: rgba(27, 31, 35, 0.05);
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 85%;
      padding: 0.2em 0.4em;
    }

    pre {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow: auto;
      line-height: 1.45;
    }

    pre code {
      background-color: transparent;
      padding: 0;
      font-size: 100%;
    }

    blockquote {
      border-left: 4px solid #dfe2e5;
      color: #6a737d;
      padding-left: 1em;
      margin-left: 0;
    }

    ul, ol {
      padding-left: 2em;
      margin-bottom: 1em;
    }

    li {
      margin-bottom: 0.25em;
    }

    table {
      border-collapse: collapse;
      margin-bottom: 1em;
      width: 100%;
    }

    table th, table td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }

    table th {
      background-color: #f6f8fa;
      font-weight: 600;
    }

    table tr:nth-child(even) {
      background-color: #f6f8fa;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    hr {
      border: 0;
      border-top: 1px solid #eaeaea;
      margin: 1.5em 0;
    }

    .task-list-item {
      list-style-type: none;
    }

    .task-list-item input {
      margin-right: 0.5em;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;

    await writeTextFile(filePath, htmlDocument);
    alert(`Successfully exported to ${filePath}`);
  } catch (error) {
    console.error("Error exporting to HTML:", error);
    alert(`Failed to export to HTML: ${error}`);
  }
}

/**
 * Export current document to PDF (saves HTML and opens in browser)
 */
export async function exportToPDF(): Promise<void> {
  try {
    if (!state.currentFile) {
      alert("Please open or save a file first before exporting.");
      return;
    }

    const filename = getFileName();
    const filePath = await save({
      defaultPath: `${filename}.html`,
      filters: [{
        name: "HTML for PDF",
        extensions: ["html"]
      }]
    });

    if (!filePath) {
      return; // User cancelled
    }

    // Get rendered HTML lines
    const renderedLines = await renderAllLinesToHTML();
    const content = renderedLines.join('\n');

    // Get CSS for styling
    const katexCSS = getKaTeXCSS();

    // Create a complete HTML document optimized for printing
    const htmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">
  <style>
    ${katexCSS}

    @page {
      margin: 1in;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }

      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }

      pre, blockquote {
        page-break-inside: avoid;
      }

      img {
        max-width: 100%;
        page-break-inside: avoid;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background-color: #ffffff;
      color: #333333;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
    }

    h1 { font-size: 2em; border-bottom: 1px solid #eaeaea; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaeaea; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; color: #6a737d; }

    p { margin-bottom: 1em; }

    a {
      color: #0366d6;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      background-color: rgba(27, 31, 35, 0.05);
      border-radius: 3px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 85%;
      padding: 0.2em 0.4em;
    }

    pre {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow: auto;
      line-height: 1.45;
    }

    pre code {
      background-color: transparent;
      padding: 0;
      font-size: 100%;
    }

    blockquote {
      border-left: 4px solid #dfe2e5;
      color: #6a737d;
      padding-left: 1em;
      margin-left: 0;
    }

    ul, ol {
      padding-left: 2em;
      margin-bottom: 1em;
    }

    li {
      margin-bottom: 0.25em;
    }

    table {
      border-collapse: collapse;
      margin-bottom: 1em;
      width: 100%;
    }

    table th, table td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }

    table th {
      background-color: #f6f8fa;
      font-weight: 600;
    }

    table tr:nth-child(even) {
      background-color: #f6f8fa;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    hr {
      border: 0;
      border-top: 1px solid #eaeaea;
      margin: 1.5em 0;
    }

    .task-list-item {
      list-style-type: none;
    }

    .task-list-item input {
      margin-right: 0.5em;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;

    // Save the HTML file
    await writeTextFile(filePath, htmlDocument);

    // Try to automatically open the file in default browser
    try {
      await invoke("plugin:opener|open_path", { path: filePath });

      // Show success message with instructions
      alert(`File saved and opened in your browser!\n\nTo save as PDF:\n1. Press Ctrl+P (Cmd+P on Mac)\n2. Select "Save as PDF"\n3. Click Save`);
    } catch (openError) {
      // If auto-open fails, just show where the file was saved
      console.warn("Could not auto-open file:", openError);
      alert(`File saved successfully to:\n${filePath}\n\nTo save as PDF:\n1. Open this file in your browser\n2. Press Ctrl+P (Cmd+P on Mac)\n3. Select "Save as PDF"\n4. Click Save`);
    }
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    alert(`Failed to export: ${error}`);
  }
}
