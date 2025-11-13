use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub use_regex: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub line: usize,
    pub column: usize,
    pub length: usize,
    pub text: String,
    pub line_text: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResult {
    pub file_path: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplaceResult {
    pub new_content: String,
    pub replaced_count: usize,
}

/// Search for a query in text content
#[tauri::command]
pub fn search_in_content(
    query: String,
    content: String,
    options: SearchOptions,
) -> Result<Vec<SearchMatch>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let mut matches = Vec::new();

    // Build the search pattern
    let pattern = if options.use_regex {
        query.clone()
    } else if options.whole_word {
        format!(r"\b{}\b", regex::escape(&query))
    } else {
        regex::escape(&query)
    };

    // Create regex with appropriate flags
    let regex_pattern = if options.case_sensitive {
        pattern
    } else {
        format!("(?i){}", pattern)
    };

    let re = Regex::new(&regex_pattern).map_err(|e| e.to_string())?;

    // Search line by line
    for (line_num, line) in content.lines().enumerate() {
        for mat in re.find_iter(line) {
            matches.push(SearchMatch {
                line: line_num + 1,
                column: mat.start() + 1,
                length: mat.end() - mat.start(),
                text: mat.as_str().to_string(),
                line_text: line.to_string(),
            });
        }
    }

    Ok(matches)
}

/// Replace all occurrences in content
#[tauri::command]
pub fn replace_in_content(
    query: String,
    replacement: String,
    content: String,
    options: SearchOptions,
) -> Result<ReplaceResult, String> {
    if query.is_empty() {
        return Ok(ReplaceResult {
            new_content: content,
            replaced_count: 0,
        });
    }

    // Build the search pattern
    let pattern = if options.use_regex {
        query.clone()
    } else if options.whole_word {
        format!(r"\b{}\b", regex::escape(&query))
    } else {
        regex::escape(&query)
    };

    // Create regex with appropriate flags
    let regex_pattern = if options.case_sensitive {
        pattern
    } else {
        format!("(?i){}", pattern)
    };

    let re = Regex::new(&regex_pattern).map_err(|e| e.to_string())?;

    // Count matches before replacement
    let count = re.find_iter(&content).count();

    // Perform replacement
    let new_content = re.replace_all(&content, replacement.as_str()).to_string();

    Ok(ReplaceResult {
        new_content,
        replaced_count: count,
    })
}

/// Search across all files in a directory
#[tauri::command]
pub fn search_in_directory(
    query: String,
    dir_path: String,
    options: SearchOptions,
) -> Result<Vec<FileSearchResult>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let path = Path::new(&dir_path);
    if !path.exists() || !path.is_dir() {
        return Err("Directory does not exist".to_string());
    }

    let mut results = Vec::new();

    // Walk through directory
    for entry in WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();

        // Only search in .md files
        if !entry_path.is_file() {
            continue;
        }

        if let Some(ext) = entry_path.extension() {
            if ext != "md" {
                continue;
            }
        } else {
            continue;
        }

        // Read file content
        let content = match fs::read_to_string(entry_path) {
            Ok(c) => c,
            Err(_) => continue, // Skip files we can't read
        };

        // Search in content
        match search_in_content(query.clone(), content, options.clone()) {
            Ok(matches) if !matches.is_empty() => {
                results.push(FileSearchResult {
                    file_path: entry_path.to_string_lossy().to_string(),
                    matches,
                });
            }
            _ => continue,
        }
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_case_sensitive() {
        let content = "Hello World\nhello world".to_string();
        let options = SearchOptions {
            case_sensitive: true,
            whole_word: false,
            use_regex: false,
        };

        let matches = search_in_content("Hello".to_string(), content, options).unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].line, 1);
    }

    #[test]
    fn test_search_case_insensitive() {
        let content = "Hello World\nhello world".to_string();
        let options = SearchOptions {
            case_sensitive: false,
            whole_word: false,
            use_regex: false,
        };

        let matches = search_in_content("hello".to_string(), content, options).unwrap();
        assert_eq!(matches.len(), 2);
    }

    #[test]
    fn test_search_whole_word() {
        let content = "hello helloworld".to_string();
        let options = SearchOptions {
            case_sensitive: false,
            whole_word: true,
            use_regex: false,
        };

        let matches = search_in_content("hello".to_string(), content, options).unwrap();
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn test_replace() {
        let content = "Hello World\nHello Universe".to_string();
        let options = SearchOptions {
            case_sensitive: false,
            whole_word: false,
            use_regex: false,
        };

        let result = replace_in_content(
            "Hello".to_string(),
            "Hi".to_string(),
            content,
            options,
        ).unwrap();

        assert_eq!(result.replaced_count, 2);
        assert_eq!(result.new_content, "Hi World\nHi Universe");
    }
}
