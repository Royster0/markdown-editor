/**
 * Inline markdown rendering utilities
 *
 * This module handles rendering of inline markdown elements such as
 * bold, italic, code, links, etc.
 */

use regex::Regex;
use once_cell::sync::Lazy;

// Pre-compiled regex patterns for better performance
static BOLD_ITALIC_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\*\*\*(.+?)\*\*\*").unwrap());
static BOLD_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\*\*(.+?)\*\*").unwrap());
static BOLD_UNDERSCORE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"__(.+?)__").unwrap());
static ITALIC_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\*(.+?)\*").unwrap());
static ITALIC_UNDERSCORE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"_(.+?)_").unwrap());
static STRIKE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"~~(.+?)~~").unwrap());
static CODE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"`([^`]+)`").unwrap());
static LINK_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\[([^\]]+)\]\(([^\)]+)\)").unwrap());

/// Render inline markdown (bold, italic, code, links, etc.)
///
/// Note: LaTeX rendering is still handled on the frontend via KaTeX
pub fn render_inline_markdown(text: &str) -> String {
    let mut result = text.to_string();

    // Bold + Italic (must come before individual bold/italic)
    result = BOLD_ITALIC_RE
        .replace_all(&result, "<strong><em>$1</em></strong>")
        .to_string();

    // Bold
    result = BOLD_RE
        .replace_all(&result, "<strong>$1</strong>")
        .to_string();
    result = BOLD_UNDERSCORE_RE
        .replace_all(&result, "<strong>$1</strong>")
        .to_string();

    // Italic
    result = ITALIC_RE.replace_all(&result, "<em>$1</em>").to_string();
    result = ITALIC_UNDERSCORE_RE
        .replace_all(&result, "<em>$1</em>")
        .to_string();

    // Strikethrough
    result = STRIKE_RE.replace_all(&result, "<del>$1</del>").to_string();

    // Inline code
    result = CODE_RE.replace_all(&result, "<code>$1</code>").to_string();

    // Links
    result = LINK_RE
        .replace_all(&result, "<a href=\"$2\">$1</a>")
        .to_string();

    result
}

/// Render inline markdown with markers visible (for editing mode)
pub fn render_inline_markdown_with_markers(text: &str) -> String {
    let mut result = text.to_string();

    // Bold + Italic (must come before individual bold/italic)
    result = BOLD_ITALIC_RE
        .replace_all(&result, "<strong><em>***$1***</em></strong>")
        .to_string();

    // Bold
    result = BOLD_RE
        .replace_all(&result, "<strong>**$1**</strong>")
        .to_string();
    result = BOLD_UNDERSCORE_RE
        .replace_all(&result, "<strong>__$1__</strong>")
        .to_string();

    // Italic
    result = ITALIC_RE
        .replace_all(&result, "<em>*$1*</em>")
        .to_string();
    result = ITALIC_UNDERSCORE_RE
        .replace_all(&result, "<em>_$1_</em>")
        .to_string();

    // Strikethrough
    result = STRIKE_RE
        .replace_all(&result, "<del>~~$1~~</del>")
        .to_string();

    // Inline code
    result = CODE_RE
        .replace_all(&result, "<code>`$1`</code>")
        .to_string();

    // Links
    result = LINK_RE
        .replace_all(&result, "<a href=\"$2\">[$1]($2)</a>")
        .to_string();

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inline_markdown() {
        let text = "This is **bold** and *italic* and `code`";
        let result = render_inline_markdown(text);
        assert!(result.contains("<strong>bold</strong>"));
        assert!(result.contains("<em>italic</em>"));
        assert!(result.contains("<code>code</code>"));
    }

    #[test]
    fn test_inline_markdown_with_markers() {
        let text = "This is **bold** and *italic*";
        let result = render_inline_markdown_with_markers(text);
        assert!(result.contains("<strong>**bold**</strong>"));
        assert!(result.contains("<em>*italic*</em>"));
    }

    #[test]
    fn test_bold_italic_combination() {
        let text = "This is ***bold and italic***";
        let result = render_inline_markdown(text);
        assert!(result.contains("<strong><em>bold and italic</em></strong>"));
    }

    #[test]
    fn test_links() {
        let text = "Check out [this link](https://example.com)";
        let result = render_inline_markdown(text);
        assert!(result.contains("<a href=\"https://example.com\">this link</a>"));
    }

    #[test]
    fn test_strikethrough() {
        let text = "This is ~~strikethrough~~";
        let result = render_inline_markdown(text);
        assert!(result.contains("<del>strikethrough</del>"));
    }
}
