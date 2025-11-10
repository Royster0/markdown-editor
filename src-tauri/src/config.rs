use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Theme configuration with all CSS variables
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    pub name: String,
    pub author: Option<String>,
    pub version: Option<String>,
    pub variables: HashMap<String, String>,
}

/// Application settings stored in config.json
#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub current_theme: String,
    #[serde(default = "default_status_bar_visible")]
    pub status_bar_visible: bool,
    #[serde(default)]
    pub keybinds: HashMap<String, String>,
    #[serde(default = "default_true")]
    pub confirm_file_delete: bool,
    #[serde(default = "default_true")]
    pub confirm_folder_delete: bool,
    #[serde(default)]
    pub custom_settings: HashMap<String, serde_json::Value>,
}

fn default_status_bar_visible() -> bool {
    true
}

fn default_true() -> bool {
    true
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            current_theme: "dark".to_string(),
            status_bar_visible: true,
            keybinds: HashMap::new(),
            confirm_file_delete: true,
            confirm_folder_delete: true,
            custom_settings: HashMap::new(),
        }
    }
}

/// Get the path to the .loom directory in the specified folder
pub fn get_loom_dir(folder_path: Option<String>) -> Result<PathBuf, String> {
    match folder_path {
        Some(path) => {
            let folder = PathBuf::from(path);
            if !folder.exists() {
                return Err("Folder does not exist".to_string());
            }
            if !folder.is_dir() {
                return Err("Path is not a directory".to_string());
            }
            Ok(folder.join(".loom"))
        }
        None => Err("No folder path provided".to_string()),
    }
}

/// Initialize the .loom directory structure in the specified folder
pub fn initialize_loom_dir(folder_path: Option<String>) -> Result<(), String> {
    let loom_dir = get_loom_dir(folder_path)?;

    // Create main .loom directory
    fs::create_dir_all(&loom_dir)
        .map_err(|e| format!("Failed to create .loom directory: {}", e))?;

    // Create subdirectories
    let themes_dir = loom_dir.join("themes");
    let builtin_themes_dir = themes_dir.join("built-in");
    let custom_themes_dir = themes_dir.join("custom");
    let plugins_dir = loom_dir.join("plugins");

    fs::create_dir_all(&builtin_themes_dir)
        .map_err(|e| format!("Failed to create themes/built-in directory: {}", e))?;
    fs::create_dir_all(&custom_themes_dir)
        .map_err(|e| format!("Failed to create themes/custom directory: {}", e))?;
    fs::create_dir_all(&plugins_dir)
        .map_err(|e| format!("Failed to create plugins directory: {}", e))?;

    // Create default config.json if it doesn't exist
    let config_path = loom_dir.join("config.json");
    if !config_path.exists() {
        let default_config = AppConfig::default();
        let json = serde_json::to_string_pretty(&default_config)
            .map_err(|e| format!("Failed to serialize default config: {}", e))?;
        fs::write(&config_path, json)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
    }

    // Create built-in themes if they don't exist
    create_builtin_themes(&builtin_themes_dir)?;

    Ok(())
}

/// Create built-in theme files
fn create_builtin_themes(builtin_dir: &PathBuf) -> Result<(), String> {
    // Dark theme
    let dark_theme_path = builtin_dir.join("dark.json");
    if !dark_theme_path.exists() {
        let dark_theme = get_default_dark_theme();
        let json = serde_json::to_string_pretty(&dark_theme)
            .map_err(|e| format!("Failed to serialize dark theme: {}", e))?;
        fs::write(&dark_theme_path, json)
            .map_err(|e| format!("Failed to write dark theme: {}", e))?;
    }

    // Light theme
    let light_theme_path = builtin_dir.join("light.json");
    if !light_theme_path.exists() {
        let light_theme = get_default_light_theme();
        let json = serde_json::to_string_pretty(&light_theme)
            .map_err(|e| format!("Failed to serialize light theme: {}", e))?;
        fs::write(&light_theme_path, json)
            .map_err(|e| format!("Failed to write light theme: {}", e))?;
    }

    Ok(())
}

/// Get default dark theme configuration
fn get_default_dark_theme() -> ThemeConfig {
    let mut variables = HashMap::new();

    // Base colors
    variables.insert("bg-primary".to_string(), "#1e1e1e".to_string());
    variables.insert("bg-secondary".to_string(), "#252526".to_string());
    variables.insert("bg-tertiary".to_string(), "#2d2d30".to_string());
    variables.insert("text-primary".to_string(), "#d4d4d4".to_string());
    variables.insert("text-secondary".to_string(), "#858585".to_string());
    variables.insert("border-color".to_string(), "#3e3e42".to_string());
    variables.insert("accent-color".to_string(), "#007acc".to_string());
    variables.insert("accent-hover".to_string(), "#0098ff".to_string());

    // Heading colors
    variables.insert("heading-color".to_string(), "#4ec9b0".to_string());
    variables.insert("h1-color".to_string(), "#569cd6".to_string());
    variables.insert("h2-color".to_string(), "#4ec9b0".to_string());
    variables.insert("h3-color".to_string(), "#dcdcaa".to_string());
    variables.insert("h4-color".to_string(), "#9cdcfe".to_string());
    variables.insert("h5-color".to_string(), "#c586c0".to_string());
    variables.insert("h6-color".to_string(), "#858585".to_string());

    // Syntax colors
    variables.insert("code-bg".to_string(), "#1e1e1e".to_string());
    variables.insert("code-color".to_string(), "#ce9178".to_string());
    variables.insert("link-color".to_string(), "#3794ff".to_string());
    variables.insert("blockquote-border".to_string(), "#007acc".to_string());
    variables.insert("blockquote-bg".to_string(), "#1e1e1e".to_string());
    variables.insert("table-border".to_string(), "#3e3e42".to_string());
    variables.insert("table-header-bg".to_string(), "#2d2d30".to_string());
    variables.insert("list-marker".to_string(), "#569cd6".to_string());
    variables.insert("hr-color".to_string(), "#3e3e42".to_string());

    ThemeConfig {
        name: "Dark".to_string(),
        author: Some("Loom.md".to_string()),
        version: Some("1.0.0".to_string()),
        variables,
    }
}

/// Get default light theme configuration
fn get_default_light_theme() -> ThemeConfig {
    let mut variables = HashMap::new();

    // Base colors
    variables.insert("bg-primary".to_string(), "#ffffff".to_string());
    variables.insert("bg-secondary".to_string(), "#f3f3f3".to_string());
    variables.insert("bg-tertiary".to_string(), "#e8e8e8".to_string());
    variables.insert("text-primary".to_string(), "#1e1e1e".to_string());
    variables.insert("text-secondary".to_string(), "#6e6e6e".to_string());
    variables.insert("border-color".to_string(), "#d4d4d4".to_string());
    variables.insert("accent-color".to_string(), "#007acc".to_string());
    variables.insert("accent-hover".to_string(), "#005a9e".to_string());

    // Heading colors
    variables.insert("heading-color".to_string(), "#267f99".to_string());
    variables.insert("h1-color".to_string(), "#0066cc".to_string());
    variables.insert("h2-color".to_string(), "#267f99".to_string());
    variables.insert("h3-color".to_string(), "#795e26".to_string());
    variables.insert("h4-color".to_string(), "#0066cc".to_string());
    variables.insert("h5-color".to_string(), "#af00db".to_string());
    variables.insert("h6-color".to_string(), "#6e6e6e".to_string());

    // Syntax colors
    variables.insert("code-bg".to_string(), "#f5f5f5".to_string());
    variables.insert("code-color".to_string(), "#a31515".to_string());
    variables.insert("link-color".to_string(), "#0066cc".to_string());
    variables.insert("blockquote-border".to_string(), "#007acc".to_string());
    variables.insert("blockquote-bg".to_string(), "#f5f5f5".to_string());
    variables.insert("table-border".to_string(), "#d4d4d4".to_string());
    variables.insert("table-header-bg".to_string(), "#e8e8e8".to_string());
    variables.insert("list-marker".to_string(), "#0066cc".to_string());
    variables.insert("hr-color".to_string(), "#d4d4d4".to_string());

    ThemeConfig {
        name: "Light".to_string(),
        author: Some("Loom.md".to_string()),
        version: Some("1.0.0".to_string()),
        variables,
    }
}

/// Load application config from the specified folder
pub fn load_app_config(folder_path: Option<String>) -> Result<AppConfig, String> {
    let loom_dir = get_loom_dir(folder_path)?;
    let config_path = loom_dir.join("config.json");

    if !config_path.exists() {
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config file: {}", e))
}

/// Save application config to the specified folder
pub fn save_app_config(folder_path: Option<String>, config: &AppConfig) -> Result<(), String> {
    let loom_dir = get_loom_dir(folder_path)?;
    let config_path = loom_dir.join("config.json");

    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, json)
        .map_err(|e| format!("Failed to write config file: {}", e))
}

/// Load a theme by name from the specified folder
pub fn load_theme(folder_path: Option<String>, theme_name: &str) -> Result<ThemeConfig, String> {
    let loom_dir = get_loom_dir(folder_path)?;

    // Try built-in themes first
    let builtin_path = loom_dir.join("themes").join("built-in").join(format!("{}.json", theme_name));
    if builtin_path.exists() {
        return load_theme_from_path(&builtin_path);
    }

    // Try custom themes
    let custom_path = loom_dir.join("themes").join("custom").join(format!("{}.json", theme_name));
    if custom_path.exists() {
        return load_theme_from_path(&custom_path);
    }

    Err(format!("Theme '{}' not found", theme_name))
}

/// Load theme from a file path
fn load_theme_from_path(path: &PathBuf) -> Result<ThemeConfig, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read theme file: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse theme file: {}", e))
}

/// List all available themes in the specified folder
pub fn list_themes(folder_path: Option<String>) -> Result<Vec<String>, String> {
    let loom_dir = get_loom_dir(folder_path)?;
    let mut themes = Vec::new();

    // List built-in themes
    let builtin_dir = loom_dir.join("themes").join("built-in");
    if builtin_dir.exists() {
        let entries = fs::read_dir(&builtin_dir)
            .map_err(|e| format!("Failed to read built-in themes directory: {}", e))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                        themes.push(name.to_string());
                    }
                }
            }
        }
    }

    // List custom themes
    let custom_dir = loom_dir.join("themes").join("custom");
    if custom_dir.exists() {
        let entries = fs::read_dir(&custom_dir)
            .map_err(|e| format!("Failed to read custom themes directory: {}", e))?;

        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                        themes.push(name.to_string());
                    }
                }
            }
        }
    }

    Ok(themes)
}

/// Import a theme from an external path to the custom themes folder
pub fn import_theme(folder_path: Option<String>, source_path: String) -> Result<String, String> {
    let loom_dir = get_loom_dir(folder_path)?;
    let source = PathBuf::from(&source_path);

    if !source.exists() {
        return Err("Source theme file does not exist".to_string());
    }

    // Load and validate the theme
    let theme = load_theme_from_path(&source)?;

    // Copy to custom themes folder
    let custom_dir = loom_dir.join("themes").join("custom");
    let dest_path = custom_dir.join(format!("{}.json", theme.name.to_lowercase()));

    fs::copy(&source, &dest_path)
        .map_err(|e| format!("Failed to import theme: {}", e))?;

    Ok(theme.name.to_lowercase())
}

/// Export a theme to an external path
pub fn export_theme(folder_path: Option<String>, theme_name: String, dest_path: String) -> Result<(), String> {
    let theme = load_theme(folder_path, &theme_name)?;

    let json = serde_json::to_string_pretty(&theme)
        .map_err(|e| format!("Failed to serialize theme: {}", e))?;

    fs::write(&dest_path, json)
        .map_err(|e| format!("Failed to write theme file: {}", e))
}

/// Get the default dark theme (for when no folder is open)
pub fn get_default_dark_theme_config() -> ThemeConfig {
    get_default_dark_theme()
}

/// Get the default light theme (for when no folder is open)
pub fn get_default_light_theme_config() -> ThemeConfig {
    get_default_light_theme()
}
