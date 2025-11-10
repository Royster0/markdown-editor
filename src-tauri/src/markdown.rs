use regex::Regex;
use serde::{Deserialize, Serialize};

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

/// Check if a line is inside a code block
fn is_in_code_block(line_index: usize, all_lines: &[String]) -> (bool, bool, bool) {
    let mut in_block = false;

    for (i, line) in all_lines.iter().enumerate() {
        if i > line_index {
            break;
        }

        if line.trim().starts_with("```") {
            if i == line_index {
                // This line is a code block boundary
                return (true, !in_block, in_block);
            }
            in_block = !in_block;
        }
    }

    (in_block, false, false)
}

/// Check if a line is inside a math block
fn is_in_math_block(line_index: usize, all_lines: &[String]) -> (bool, bool, bool) {
    let mut in_block = false;

    for (i, line) in all_lines.iter().enumerate() {
        if i > line_index {
            break;
        }

        if line.trim() == "$$" {
            if i == line_index {
                // This line is a math block boundary
                return (true, !in_block, in_block);
            }
            in_block = !in_block;
        }
    }

    (in_block, false, false)
}

/// Escape HTML entities
fn escape_html(text: &str) -> String {
    html_escape::encode_text(text).to_string()
}

/// Render inline markdown (bold, italic, code, links, etc.)
/// Note: LaTeX rendering is still handled on the frontend via KaTeX
fn render_inline_markdown(text: &str) -> String {
    let mut result = text.to_string();

    // Bold + Italic (must come before individual bold/italic)
    let bold_italic_re = Regex::new(r"\*\*\*(.+?)\*\*\*").unwrap();
    result = bold_italic_re.replace_all(&result, "<strong><em>$1</em></strong>").to_string();

    // Bold
    let bold_re = Regex::new(r"\*\*(.+?)\*\*").unwrap();
    result = bold_re.replace_all(&result, "<strong>$1</strong>").to_string();
    let bold_underscore_re = Regex::new(r"__(.+?)__").unwrap();
    result = bold_underscore_re.replace_all(&result, "<strong>$1</strong>").to_string();

    // Italic
    let italic_re = Regex::new(r"\*(.+?)\*").unwrap();
    result = italic_re.replace_all(&result, "<em>$1</em>").to_string();
    let italic_underscore_re = Regex::new(r"_(.+?)_").unwrap();
    result = italic_underscore_re.replace_all(&result, "<em>$1</em>").to_string();

    // Strikethrough
    let strike_re = Regex::new(r"~~(.+?)~~").unwrap();
    result = strike_re.replace_all(&result, "<del>$1</del>").to_string();

    // Inline code
    let code_re = Regex::new(r"`([^`]+)`").unwrap();
    result = code_re.replace_all(&result, "<code>$1</code>").to_string();

    // Links
    let link_re = Regex::new(r"\[([^\]]+)\]\(([^\)]+)\)").unwrap();
    result = link_re.replace_all(&result, "<a href=\"$2\">$1</a>").to_string();

    result
}

/// Render inline markdown with markers visible (for editing mode)
fn render_inline_markdown_with_markers(text: &str) -> String {
    let mut result = text.to_string();

    // Bold + Italic (must come before individual bold/italic)
    let bold_italic_re = Regex::new(r"\*\*\*(.+?)\*\*\*").unwrap();
    result = bold_italic_re.replace_all(&result, "<strong><em>***$1***</em></strong>").to_string();

    // Bold
    let bold_re = Regex::new(r"\*\*(.+?)\*\*").unwrap();
    result = bold_re.replace_all(&result, "<strong>**$1**</strong>").to_string();
    let bold_underscore_re = Regex::new(r"__(.+?)__").unwrap();
    result = bold_underscore_re.replace_all(&result, "<strong>__$1__</strong>").to_string();

    // Italic
    let italic_re = Regex::new(r"\*(.+?)\*").unwrap();
    result = italic_re.replace_all(&result, "<em>*$1*</em>").to_string();
    let italic_underscore_re = Regex::new(r"_(.+?)_").unwrap();
    result = italic_underscore_re.replace_all(&result, "<em>_$1_</em>").to_string();

    // Strikethrough
    let strike_re = Regex::new(r"~~(.+?)~~").unwrap();
    result = strike_re.replace_all(&result, "<del>~~$1~~</del>").to_string();

    // Inline code
    let code_re = Regex::new(r"`([^`]+)`").unwrap();
    result = code_re.replace_all(&result, "<code>`$1`</code>").to_string();

    // Links
    let link_re = Regex::new(r"\[([^\]]+)\]\(([^\)]+)\)").unwrap();
    result = link_re.replace_all(&result, "<a href=\"$2\">[$1]($2)</a>").to_string();

    result
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
        let lang_re = Regex::new(r"^```(\w+)?").unwrap();
        let lang = lang_re.captures(line.trim())
            .and_then(|cap| cap.get(1))
            .map(|m| m.as_str())
            .unwrap_or("");

        if is_editing {
            // Show the ``` with styling
            return LineRenderResult {
                html: format!("<span class=\"code-block-start\" data-lang=\"{}\">{}</span>", lang, escape_html(line.trim())),
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
            // When editing, show raw code with a span for styling (not <code> to prevent corruption)
            return LineRenderResult {
                html: format!("<span class=\"code-block-line-editing\">{}</span>", escape_html(line)),
                is_code_block_boundary: false,
            };
        } else {
            // When not editing, wrap in code tag for styling
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
            // When editing, show raw LaTeX without rendering
            return LineRenderResult {
                html: escape_html(line),
                is_code_block_boundary: false,
            };
        } else {
            // When not editing, wrap in a span with class for LaTeX rendering
            // The frontend KaTeX will process this
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
    let hr_re = Regex::new(r"^(---+|\*\*\*+|___+)$").unwrap();
    if hr_re.is_match(line) {
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
    let header_re = Regex::new(r"^(#{1,6})\s+(.+)$").unwrap();
    if let Some(cap) = header_re.captures(line) {
        let level = cap.get(1).unwrap().as_str().len();
        let hashes = cap.get(1).unwrap().as_str();
        let text = cap.get(2).unwrap().as_str();

        if is_editing {
            // Show markers with styling
            let processed_text = render_inline_markdown_with_markers(text);
            return LineRenderResult {
                html: format!("<span class=\"heading h{}\">{} {}</span>", level, hashes, processed_text),
                is_code_block_boundary: false,
            };
        } else {
            // Hide markers
            let processed_text = render_inline_markdown(text);
            return LineRenderResult {
                html: format!("<span class=\"heading h{}\">{}</span>", level, processed_text),
                is_code_block_boundary: false,
            };
        }
    }

    // List items
    let list_re = Regex::new(r"^(\s*)([-*+]|\d+\.)\s+(.+)$").unwrap();
    if let Some(cap) = list_re.captures(line) {
        let indent_spaces = cap.get(1).unwrap().as_str();
        let indent = indent_spaces.len();
        let marker = cap.get(2).unwrap().as_str();
        let text = cap.get(3).unwrap().as_str();
        let is_ordered = marker.chars().next().unwrap().is_numeric();
        let marker_class = if is_ordered { "ordered" } else { "unordered" };

        if is_editing {
            // In editing mode, show the full markdown including indentation
            let processed_text = render_inline_markdown_with_markers(text);
            return LineRenderResult {
                html: format!(
                    "<span class=\"list-item\">{}{} {}</span>",
                    indent_spaces,
                    marker,
                    processed_text
                ),
                is_code_block_boundary: false,
            };
        } else {
            // In non-editing mode, use CSS for indentation
            let processed_text = render_inline_markdown(text);
            return LineRenderResult {
                html: format!(
                    "<span class=\"list-item\" style=\"padding-left: {}px\">\
                    <span class=\"list-marker {}\">{}</span> \
                    {}\
                    </span>",
                    indent * 20,
                    marker_class,
                    marker,
                    processed_text
                ),
                is_code_block_boundary: false,
            };
        }
    }

    // Blockquote
    let blockquote_re = Regex::new(r"^>\s*(.+)$").unwrap();
    if let Some(cap) = blockquote_re.captures(line) {
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

    #[test]
    fn test_inline_markdown() {
        let text = "This is **bold** and *italic* and `code`";
        let result = render_inline_markdown(text);
        assert!(result.contains("<strong>bold</strong>"));
        assert!(result.contains("<em>italic</em>"));
        assert!(result.contains("<code>code</code>"));
    }
}
