/**
 * Markdown rendering - Main module
 *
 * This module coordinates markdown rendering by using block detection
 * and inline rendering utilities to convert markdown to HTML.
 */

use regex::Regex;
use serde::{Deserialize, Serialize};
use once_cell::sync::Lazy;

mod block_detection;
mod inline_rendering;

use block_detection::{is_in_code_block, is_in_math_block};
use inline_rendering::{render_inline_markdown, render_inline_markdown_with_markers};

// Pre-compiled regex patterns for block-level elements
static LANG_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^```(\w+)?").unwrap());
static HR_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(---+|\*\*\*+|___+)$").unwrap());
static HEADER_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(#{1,6})\s+(.+)$").unwrap());
static LIST_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^(\s*)([-*+]|\d+\.)\s+(.+)$").unwrap());
static BLOCKQUOTE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^>\s*(.+)$").unwrap());

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineRenderResult {
    pub html: String,
    pub is_code_block_boundary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderRequest {
    pub line: String,
    pub line_index: usize,
    pub all_lines: Vec<String>,
    pub is_editing: bool,
}

/// Escape HTML entities
fn escape_html(text: &str) -> String {
    html_escape::encode_text(text).to_string()
}

/// Render a single markdown line to HTML
pub fn render_markdown_line(request: RenderRequest) -> LineRenderResult {
    let line = &request.line;
    let line_index = request.line_index;
    let all_lines = &request.all_lines;
    let is_editing = request.is_editing;

    // Check if this line is part of a code block
    let (in_block, is_start, is_end) = is_in_code_block(line_index, all_lines);

    if is_start {
        // Starting ``` line - extract language if present
        let lang = LANG_RE
            .captures(line.trim())
            .and_then(|cap| cap.get(1))
            .map(|m| m.as_str())
            .unwrap_or("");

        if is_editing {
            return LineRenderResult {
                html: format!(
                    "<span class=\"code-block-start\" data-lang=\"{}\">{}</span>",
                    lang,
                    escape_html(line.trim())
                ),
                is_code_block_boundary: true,
            };
        } else {
            return LineRenderResult {
                html: format!("<span class=\"code-block-start\" data-lang=\"{}\"></span>", lang),
                is_code_block_boundary: true,
            };
        }
    }

    if is_end {
        // Ending ``` line
        if is_editing {
            return LineRenderResult {
                html: format!("<span class=\"code-block-end\">{}</span>", escape_html(line.trim())),
                is_code_block_boundary: true,
            };
        } else {
            return LineRenderResult {
                html: "<span class=\"code-block-end\"></span>".to_string(),
                is_code_block_boundary: true,
            };
        }
    }

    if in_block {
        // Inside code block
        if is_editing {
            return LineRenderResult {
                html: format!("<span class=\"code-block-line-editing\">{}</span>", escape_html(line)),
                is_code_block_boundary: false,
            };
        } else {
            return LineRenderResult {
                html: format!("<code class=\"code-block-line\">{}</code>", escape_html(line)),
                is_code_block_boundary: false,
            };
        }
    }

    // Check if this line is part of a math block
    let (in_math_block, is_math_start, is_math_end) = is_in_math_block(line_index, all_lines);

    if is_math_start {
        // Starting $$ line
        if is_editing {
            return LineRenderResult {
                html: format!("<span class=\"math-block-start\">{}</span>", escape_html(line.trim())),
                is_code_block_boundary: true,
            };
        } else {
            return LineRenderResult {
                html: "<span class=\"math-block-start\"></span>".to_string(),
                is_code_block_boundary: true,
            };
        }
    }

    if is_math_end {
        // Ending $$ line
        if is_editing {
            return LineRenderResult {
                html: format!("<span class=\"math-block-end\">{}</span>", escape_html(line.trim())),
                is_code_block_boundary: true,
            };
        } else {
            return LineRenderResult {
                html: "<span class=\"math-block-end\"></span>".to_string(),
                is_code_block_boundary: true,
            };
        }
    }

    if in_math_block {
        // Inside math block
        if is_editing {
            return LineRenderResult {
                html: format!("<span class=\"math-block-line-editing\">{}</span>", escape_html(line)),
                is_code_block_boundary: false,
            };
        } else {
            return LineRenderResult {
                html: format!("<span class=\"math-block-line\">{}</span>", escape_html(line)),
                is_code_block_boundary: false,
            };
        }
    }

    // Empty line
    if line.trim().is_empty() {
        return LineRenderResult {
            html: "<br>".to_string(),
            is_code_block_boundary: false,
        };
    }

    // Horizontal rule
    if HR_RE.is_match(line) {
        if is_editing {
            return LineRenderResult {
                html: format!("<span class=\"hr\">{}</span>", escape_html(line)),
                is_code_block_boundary: false,
            };
        } else {
            return LineRenderResult {
                html: "<span class=\"hr\">───────────────────────────────────────</span>".to_string(),
                is_code_block_boundary: false,
            };
        }
    }

    // Headers
    if let Some(cap) = HEADER_RE.captures(line) {
        let level = cap.get(1).unwrap().as_str().len();
        let hashes = cap.get(1).unwrap().as_str();
        let text = cap.get(2).unwrap().as_str();

        if is_editing {
            let processed_text = render_inline_markdown_with_markers(text);
            return LineRenderResult {
                html: format!("<span class=\"heading h{}\">{} {}</span>", level, hashes, processed_text),
                is_code_block_boundary: false,
            };
        } else {
            let processed_text = render_inline_markdown(text);
            return LineRenderResult {
                html: format!("<span class=\"heading h{}\">{}</span>", level, processed_text),
                is_code_block_boundary: false,
            };
        }
    }

    // List items
    if let Some(cap) = LIST_RE.captures(line) {
        let indent_spaces = cap.get(1).unwrap().as_str();
        let indent = indent_spaces.len();
        let marker = cap.get(2).unwrap().as_str();
        let text = cap.get(3).unwrap().as_str();
        let is_ordered = marker.chars().next().unwrap().is_numeric();
        let marker_class = if is_ordered { "ordered" } else { "unordered" };

        if is_editing {
            let processed_text = render_inline_markdown_with_markers(text);
            return LineRenderResult {
                html: format!(
                    "<span class=\"list-item\">{}{} {}</span>",
                    indent_spaces, marker, processed_text
                ),
                is_code_block_boundary: false,
            };
        } else {
            let processed_text = render_inline_markdown(text);
            let display_marker = if is_ordered { marker } else { "•" };
            return LineRenderResult {
                html: format!(
                    "<span class=\"list-item\" style=\"padding-left: {}px\">\
                    <span class=\"list-marker {}\">{}</span>\
                    {}\
                    </span>",
                    indent * 20,
                    marker_class,
                    display_marker,
                    processed_text
                ),
                is_code_block_boundary: false,
            };
        }
    }

    // Blockquote
    if let Some(cap) = BLOCKQUOTE_RE.captures(line) {
        let text = cap.get(1).unwrap().as_str();

        if is_editing {
            let processed_text = render_inline_markdown_with_markers(text);
            return LineRenderResult {
                html: format!("<span class=\"blockquote\">&gt; {}</span>", processed_text),
                is_code_block_boundary: false,
            };
        } else {
            let processed_text = render_inline_markdown(text);
            return LineRenderResult {
                html: format!("<span class=\"blockquote\">{}</span>", processed_text),
                is_code_block_boundary: false,
            };
        }
    }

    // Regular paragraph - process inline markdown
    if is_editing {
        LineRenderResult {
            html: render_inline_markdown_with_markers(line),
            is_code_block_boundary: false,
        }
    } else {
        LineRenderResult {
            html: render_inline_markdown(line),
            is_code_block_boundary: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_rendering() {
        let request = RenderRequest {
            line: "# Hello World".to_string(),
            line_index: 0,
            all_lines: vec!["# Hello World".to_string()],
            is_editing: false,
        };
        let result = render_markdown_line(request);
        assert!(result.html.contains("heading h1"));
        assert!(result.html.contains("Hello World"));
    }

    #[test]
    fn test_code_block() {
        let lines = vec![
            "```rust".to_string(),
            "fn main() {}".to_string(),
            "```".to_string(),
        ];

        let result0 = render_markdown_line(RenderRequest {
            line: lines[0].clone(),
            line_index: 0,
            all_lines: lines.clone(),
            is_editing: false,
        });
        assert!(result0.html.contains("code-block-start"));

        let result1 = render_markdown_line(RenderRequest {
            line: lines[1].clone(),
            line_index: 1,
            all_lines: lines.clone(),
            is_editing: false,
        });
        assert!(result1.html.contains("code-block-line"));
        assert!(result1.html.contains("fn main() {}"));
    }
}
