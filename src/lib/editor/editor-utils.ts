/**
 * Editor utility functions
 * Helper functions for cursor positioning and block detection
 */

/**
 * Helper function to get the first text node, even if wrapped in elements
 * @param node - Node to search
 * @returns First text node found, or null
 */
export function getFirstTextNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node;
  }
  for (let i = 0; i < node.childNodes.length; i++) {
    const textNode = getFirstTextNode(node.childNodes[i]);
    if (textNode) return textNode;
  }
  return null;
}

/**
 * Check if a line is inside a math or code block
 * @param lineIndex - Index of the line to check
 * @param allLines - Array of all lines
 * @returns True if line is inside a block
 */
export function isLineInsideBlock(lineIndex: number, allLines: string[]): boolean {
  let inCodeBlock = false;
  let inMathBlock = false;

  for (let i = 0; i <= lineIndex; i++) {
    const line = allLines[i];
    const trimmed = line.trim();

    // Check for code block delimiters
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (i === lineIndex) {
        return false;
      }
      continue;
    }

    // Check for math block delimiters
    if (trimmed === "$$") {
      inMathBlock = !inMathBlock;
      if (i === lineIndex) {
        return false;
      }
      continue;
    }
  }

  return inCodeBlock || inMathBlock;
}
