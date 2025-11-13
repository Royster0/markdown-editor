mod markdown;
mod config;
mod file_watcher;

use markdown::{render_markdown_line, LineRenderResult, RenderRequest};
use config::{ThemeConfig, AppConfig, initialize_loom_dir, load_app_config, save_app_config,
             load_theme, list_themes, import_theme, export_theme, get_loom_dir,
             get_default_dark_theme_config, get_default_light_theme_config};
use file_watcher::{FileWatcherStateHandle, create_watcher_state};
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::State;
use base64::{engine::general_purpose, Engine as _};

// File tree structures
#[derive(Debug, Serialize, Deserialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileEntry>>,
}

// Markdown rendering commands
#[tauri::command]
fn render_markdown(request: RenderRequest) -> LineRenderResult {
    render_markdown_line(request)
}

// Batch rendering for multiple lines (parallelized for performance)
#[tauri::command]
fn render_markdown_batch(requests: Vec<RenderRequest>) -> Vec<LineRenderResult> {
    use rayon::prelude::*;

    // Use parallel iterator for large batches (>50 lines)
    if requests.len() > 50 {
        requests.into_par_iter().map(render_markdown_line).collect()
    } else {
        // For small batches, sequential is faster (no thread overhead)
        requests.into_iter().map(render_markdown_line).collect()
    }
}

// Read directory contents recursively
#[tauri::command]
fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }

    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    read_dir_recursive(&dir_path)
}

fn read_dir_recursive(dir_path: &PathBuf) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();

    let dir_entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in dir_entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories (starting with .)
        if name.starts_with('.') {
            continue;
        }

        let is_dir = path.is_dir();
        let path_str = path.to_string_lossy().to_string();

        let children = if is_dir {
            // Don't recursively read children here - we'll do it on demand in the UI
            Some(Vec::new())
        } else {
            None
        };

        entries.push(FileEntry {
            name,
            path: path_str,
            is_dir,
            children,
        });
    }

    // Sort: directories first, then files, alphabetically within each group
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

// Read file contents from a path
#[tauri::command]
fn read_file_from_path(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// Create a new file
#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Check if parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            return Err(format!("Parent directory does not exist: {:?}", parent));
        }
    }

    // Check if file already exists
    if file_path.exists() {
        return Err("File already exists".to_string());
    }

    // Create the file
    fs::write(&file_path, "").map_err(|e| format!("Failed to create file: {}", e))?;

    // Verify the file was created
    if !file_path.exists() {
        return Err("File was not created successfully".to_string());
    }

    println!("File created successfully at: {:?}", file_path);
    Ok(())
}

// Create a new folder
#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    // Check if parent directory exists
    if let Some(parent) = dir_path.parent() {
        if !parent.exists() {
            return Err("Parent directory does not exist".to_string());
        }
    }

    // Check if folder already exists
    if dir_path.exists() {
        return Err("Folder already exists".to_string());
    }

    // Create the folder
    fs::create_dir(&dir_path)
        .map_err(|e| format!("Failed to create folder: {}", e))
}

// Delete a file
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Check if file exists
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    // Check if it's actually a file
    if !file_path.is_file() {
        return Err("Path is not a file".to_string());
    }

    // Delete the file
    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    println!("File deleted successfully: {:?}", file_path);
    Ok(())
}

// Delete a folder (recursively)
#[tauri::command]
fn delete_folder(path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    // Check if folder exists
    if !dir_path.exists() {
        return Err("Folder does not exist".to_string());
    }

    // Check if it's actually a directory
    if !dir_path.is_dir() {
        return Err("Path is not a folder".to_string());
    }

    // Delete the folder recursively
    fs::remove_dir_all(&dir_path)
        .map_err(|e| format!("Failed to delete folder: {}", e))?;

    println!("Folder deleted successfully: {:?}", dir_path);
    Ok(())
}

// Count contents of a folder (files and subfolders)
#[tauri::command]
fn count_folder_contents(path: String) -> Result<(usize, usize), String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !dir_path.is_dir() {
        return Err("Path is not a folder".to_string());
    }

    let mut file_count = 0;
    let mut folder_count = 0;

    let entries = fs::read_dir(&dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            folder_count += 1;
        } else {
            file_count += 1;
        }
    }

    Ok((file_count, folder_count))
}

// Rename a file or folder
#[tauri::command]
fn rename_path(old_path: String, new_name: String) -> Result<String, String> {
    let old_path_buf = PathBuf::from(&old_path);

    // Check if path exists
    if !old_path_buf.exists() {
        return Err("Path does not exist".to_string());
    }

    // Get parent directory
    let parent = old_path_buf.parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;

    // Create new path
    let new_path_buf = parent.join(&new_name);

    // Check if new path already exists
    if new_path_buf.exists() {
        return Err("A file or folder with that name already exists".to_string());
    }

    // Rename
    fs::rename(&old_path_buf, &new_path_buf)
        .map_err(|e| format!("Failed to rename: {}", e))?;

    let new_path = new_path_buf.to_string_lossy().to_string();
    println!("Renamed {:?} to {:?}", old_path, new_path);
    Ok(new_path)
}

// Move a file or folder to a different directory
#[tauri::command]
fn move_path(source_path: String, dest_dir_path: String) -> Result<String, String> {
    let source_path_buf = PathBuf::from(&source_path);
    let dest_dir_buf = PathBuf::from(&dest_dir_path);

    // Check if source exists
    if !source_path_buf.exists() {
        return Err("Source path does not exist".to_string());
    }

    // Check if destination directory exists
    if !dest_dir_buf.exists() {
        return Err("Destination directory does not exist".to_string());
    }

    // Check if destination is a directory
    if !dest_dir_buf.is_dir() {
        return Err("Destination must be a directory".to_string());
    }

    // Get the file/folder name
    let name = source_path_buf.file_name()
        .ok_or_else(|| "Cannot get source name".to_string())?;

    // Create new path in destination directory
    let new_path_buf = dest_dir_buf.join(name);

    // Check if destination already has a file/folder with the same name
    if new_path_buf.exists() {
        return Err("A file or folder with that name already exists in the destination".to_string());
    }

    // Move (rename) the file/folder
    fs::rename(&source_path_buf, &new_path_buf)
        .map_err(|e| format!("Failed to move: {}", e))?;

    let new_path = new_path_buf.to_string_lossy().to_string();
    println!("Moved {:?} to {:?}", source_path, new_path);
    Ok(new_path)
}

// Copy a file or folder to a different directory
#[tauri::command]
fn copy_path(source_path: String, dest_dir_path: String) -> Result<String, String> {
    let source_path_buf = PathBuf::from(&source_path);
    let dest_dir_buf = PathBuf::from(&dest_dir_path);

    // Check if source exists
    if !source_path_buf.exists() {
        return Err("Source path does not exist".to_string());
    }

    // Check if destination directory exists
    if !dest_dir_buf.exists() {
        return Err("Destination directory does not exist".to_string());
    }

    // Check if destination is a directory
    if !dest_dir_buf.is_dir() {
        return Err("Destination must be a directory".to_string());
    }

    // Get the file/folder name
    let name = source_path_buf.file_name()
        .ok_or_else(|| "Cannot get source name".to_string())?;

    // Create new path in destination directory
    let new_path_buf = dest_dir_buf.join(name);

    // Check if destination already has a file/folder with the same name
    if new_path_buf.exists() {
        return Err("A file or folder with that name already exists in the destination".to_string());
    }

    // Copy the file or folder
    if source_path_buf.is_file() {
        // Copy file
        fs::copy(&source_path_buf, &new_path_buf)
            .map_err(|e| format!("Failed to copy file: {}", e))?;
    } else if source_path_buf.is_dir() {
        // Copy directory recursively with depth limit
        const MAX_DEPTH: usize = 100;
        copy_dir_recursive(&source_path_buf, &new_path_buf, 0, MAX_DEPTH)?;
    } else {
        return Err("Source is neither a file nor a directory".to_string());
    }

    let new_path = new_path_buf.to_string_lossy().to_string();
    println!("Copied {:?} to {:?}", source_path, new_path);
    Ok(new_path)
}

// Helper function to copy directory recursively with depth limit
fn copy_dir_recursive(src: &PathBuf, dest: &PathBuf, depth: usize, max_depth: usize) -> Result<(), String> {
    // Check depth limit to prevent stack overflow
    if depth >= max_depth {
        return Err(format!("Directory depth exceeds maximum limit of {}", max_depth));
    }

    // Create destination directory
    fs::create_dir(dest)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    // Read source directory
    let entries = fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        let dest_path = dest.join(&name);

        // Skip hidden files and directories (starting with .)
        if name_str.starts_with('.') {
            println!("Skipping hidden file/directory: {:?}", name_str);
            continue;
        }

        // Follow symlinks but don't copy the symlink itself
        let metadata = fs::metadata(&path)
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        if metadata.is_file() {
            fs::copy(&path, &dest_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        } else if metadata.is_dir() {
            // Recursively copy subdirectory with incremented depth
            copy_dir_recursive(&path, &dest_path, depth + 1, max_depth)?;
        }
        // Skip other types (symlinks, devices, etc.)
    }

    Ok(())
}

// Save image from base64 data to disk
#[tauri::command]
fn save_image_from_clipboard(
    base64_data: String,
    save_dir: String,
    filename_prefix: Option<String>,
) -> Result<String, String> {
    // Decode base64 data
    let image_data = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Create save directory path
    let save_dir_path = PathBuf::from(&save_dir);

    // Create directory if it doesn't exist
    if !save_dir_path.exists() {
        fs::create_dir_all(&save_dir_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Generate filename with timestamp
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();

    let prefix = filename_prefix.unwrap_or_else(|| "image".to_string());
    let filename = format!("{}-{}.png", prefix, timestamp);
    let file_path = save_dir_path.join(&filename);

    // Write image data to file
    fs::write(&file_path, image_data)
        .map_err(|e| format!("Failed to write image file: {}", e))?;

    let full_path = file_path.to_string_lossy().to_string();
    println!("Image saved successfully to: {:?}", full_path);
    Ok(full_path)
}

// File watching commands

/// Start watching a directory for file system changes
#[tauri::command]
fn start_watching_directory(
    path: String,
    app_handle: tauri::AppHandle,
    watcher_state: State<FileWatcherStateHandle>,
) -> Result<(), String> {
    let mut state = watcher_state.lock()
        .map_err(|e| format!("Failed to acquire watcher lock: {}", e))?;

    state.start_watching(&path, app_handle)
}

/// Stop watching the current directory
#[tauri::command]
fn stop_watching_directory(
    watcher_state: State<FileWatcherStateHandle>,
) -> Result<(), String> {
    let mut state = watcher_state.lock()
        .map_err(|e| format!("Failed to acquire watcher lock: {}", e))?;

    state.stop_watching();
    Ok(())
}

// Theme and config commands

/// Initialize the .loom directory structure
#[tauri::command]
fn init_loom_dir(folder_path: Option<String>) -> Result<(), String> {
    initialize_loom_dir(folder_path)
}

/// Get the path to the .loom directory
#[tauri::command]
fn get_loom_directory(folder_path: Option<String>) -> Result<String, String> {
    get_loom_dir(folder_path).map(|p| p.to_string_lossy().to_string())
}

/// Load application configuration
#[tauri::command]
fn load_config(folder_path: Option<String>) -> Result<AppConfig, String> {
    load_app_config(folder_path)
}

/// Save application configuration
#[tauri::command]
fn save_config(folder_path: Option<String>, config: AppConfig) -> Result<(), String> {
    save_app_config(folder_path, &config)
}

/// Set the current theme
#[tauri::command]
fn set_theme(folder_path: Option<String>, theme_name: String) -> Result<(), String> {
    let mut config = load_app_config(folder_path.clone())?;
    config.current_theme = theme_name;
    save_app_config(folder_path, &config)
}

/// Get the full config (simplified version without folder requirement for better compatibility)
#[tauri::command]
fn get_config(folder_path: Option<String>) -> Result<AppConfig, String> {
    load_app_config(folder_path)
}

/// Update the full config (simplified version that can update any config field)
#[tauri::command]
fn update_config(folder_path: Option<String>, config: AppConfig) -> Result<(), String> {
    save_app_config(folder_path, &config)
}

/// Get the current theme configuration
#[tauri::command]
fn get_current_theme(folder_path: Option<String>) -> Result<ThemeConfig, String> {
    match folder_path.clone() {
        Some(_) => {
            let config = load_app_config(folder_path.clone())?;
            load_theme(folder_path, &config.current_theme)
        }
        None => {
            // Return default dark theme when no folder is open
            Ok(get_default_dark_theme_config())
        }
    }
}

/// Get a theme by name
#[tauri::command]
fn get_theme(folder_path: Option<String>, theme_name: String) -> Result<ThemeConfig, String> {
    match folder_path.clone() {
        Some(_) => load_theme(folder_path, &theme_name),
        None => {
            // Return built-in themes when no folder is open
            match theme_name.as_str() {
                "dark" => Ok(get_default_dark_theme_config()),
                "light" => Ok(get_default_light_theme_config()),
                _ => Err("Theme not available without an open folder".to_string()),
            }
        }
    }
}

/// List all available themes
#[tauri::command]
fn get_available_themes(folder_path: Option<String>) -> Result<Vec<String>, String> {
    match folder_path {
        Some(_) => list_themes(folder_path),
        None => {
            // Return only built-in themes when no folder is open
            Ok(vec!["dark".to_string(), "light".to_string()])
        }
    }
}

/// Import a theme from an external file
#[tauri::command]
fn import_custom_theme(folder_path: Option<String>, source_path: String) -> Result<String, String> {
    import_theme(folder_path, source_path)
}

/// Export a theme to an external file
#[tauri::command]
fn export_custom_theme(folder_path: Option<String>, theme_name: String, dest_path: String) -> Result<(), String> {
    export_theme(folder_path, theme_name, dest_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(create_watcher_state())
        .invoke_handler(tauri::generate_handler![
            render_markdown,
            render_markdown_batch,
            read_directory,
            read_file_from_path,
            create_file,
            create_folder,
            delete_file,
            delete_folder,
            count_folder_contents,
            rename_path,
            move_path,
            copy_path,
            save_image_from_clipboard,
            start_watching_directory,
            stop_watching_directory,
            init_loom_dir,
            get_loom_directory,
            load_config,
            save_config,
            get_config,
            update_config,
            set_theme,
            get_current_theme,
            get_theme,
            get_available_themes,
            import_custom_theme,
            export_custom_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}