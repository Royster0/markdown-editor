/**
 * Block detection utilities for markdown rendering
 *
 * This module handles detection of code blocks and math blocks
 * to ensure proper context-aware rendering.
 */

/// Check if a line is inside a code block
///
/// Returns a tuple of (in_block, is_start, is_end)
/// - in_block: true if the line is inside a code block
/// - is_start: true if this line starts a code block
/// - is_end: true if this line ends a code block
pub fn is_in_code_block(line_index: usize, all_lines: &[String]) -> (bool, bool, bool) {
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
///
/// Returns a tuple of (in_block, is_start, is_end)
/// - in_block: true if the line is inside a math block
/// - is_start: true if this line starts a math block
/// - is_end: true if this line ends a math block
pub fn is_in_math_block(line_index: usize, all_lines: &[String]) -> (bool, bool, bool) {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_block_detection() {
        let lines = vec![
            "# Header".to_string(),
            "```rust".to_string(),
            "fn main() {}".to_string(),
            "```".to_string(),
            "More text".to_string(),
        ];

        let (in_block, is_start, is_end) = is_in_code_block(0, &lines);
        assert!(!in_block && !is_start && !is_end);

        let (in_block, is_start, is_end) = is_in_code_block(1, &lines);
        assert!(is_start && !is_end);

        let (in_block, is_start, is_end) = is_in_code_block(2, &lines);
        assert!(in_block && !is_start && !is_end);

        let (in_block, is_start, is_end) = is_in_code_block(3, &lines);
        assert!(is_end && !is_start);

        let (in_block, is_start, is_end) = is_in_code_block(4, &lines);
        assert!(!in_block && !is_start && !is_end);
    }

    #[test]
    fn test_math_block_detection() {
        let lines = vec![
            "Text".to_string(),
            "$$".to_string(),
            "x^2 + y^2 = z^2".to_string(),
            "$$".to_string(),
            "More text".to_string(),
        ];

        let (in_block, is_start, is_end) = is_in_math_block(0, &lines);
        assert!(!in_block && !is_start && !is_end);

        let (in_block, is_start, is_end) = is_in_math_block(1, &lines);
        assert!(is_start && !is_end);

        let (in_block, is_start, is_end) = is_in_math_block(2, &lines);
        assert!(in_block && !is_start && !is_end);

        let (in_block, is_start, is_end) = is_in_math_block(3, &lines);
        assert!(is_end && !is_start);

        let (in_block, is_start, is_end) = is_in_math_block(4, &lines);
        assert!(!in_block && !is_start && !is_end);
    }
}
