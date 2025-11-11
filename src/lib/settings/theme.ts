/**
 * Theme management module
 */

import { invoke } from "@tauri-apps/api/core";
import { ThemeConfig, AppConfig } from "../core/types";
import { state } from "../core/state";

/**
 * Initialize theme system on app startup
 */
export async function initializeTheme(): Promise<void> {
  try {
    // Initialize .loom directory if folder is open
    if (state.currentFolder) {
      await invoke("init_loom_dir", { folderPath: state.currentFolder });
    }

    // Load available themes
    const themes = await invoke<string[]>("get_available_themes", {
      folderPath: state.currentFolder
    });
    state.availableThemes = themes;

    // Load current theme from config (or use default)
    let themeName = "dark";
    if (state.currentFolder) {
      try {
        const config = await invoke<AppConfig>("load_config", {
          folderPath: state.currentFolder
        });
        themeName = config.current_theme;
      } catch (error) {
        console.log("No config found, using default theme");
      }
    }

    state.currentTheme = themeName;

    // Apply the current theme
    await applyTheme(themeName);
  } catch (error) {
    console.error("Failed to initialize theme:", error);
    // Fallback to default dark theme
    state.currentTheme = "dark";
    state.availableThemes = ["dark", "light"];
    // Apply default dark theme
    const defaultTheme = await invoke<ThemeConfig>("get_current_theme", {
      folderPath: null
    });
    applyThemeVariables(defaultTheme);
  }
}

/**
 * Re-initialize theme system when folder changes
 */
export async function reinitializeThemeForFolder(): Promise<void> {
  await initializeTheme();
}

/**
 * Apply a theme by name
 */
export async function applyTheme(themeName: string): Promise<void> {
  try {
    const theme = await invoke<ThemeConfig>("get_theme", {
      folderPath: state.currentFolder,
      themeName
    });
    applyThemeVariables(theme);
    state.currentTheme = themeName;
  } catch (error) {
    console.error(`Failed to apply theme '${themeName}':`, error);
    throw error;
  }
}

/**
 * Apply theme variables to CSS custom properties
 */
function applyThemeVariables(theme: ThemeConfig): void {
  const root = document.documentElement;

  // Apply each CSS variable from the theme
  for (const [key, value] of Object.entries(theme.variables)) {
    root.style.setProperty(`--${key}`, value);
  }
}

/**
 * Switch to a different theme and save the preference
 */
export async function switchTheme(themeName: string): Promise<void> {
  try {
    // Apply the theme
    await applyTheme(themeName);

    // Save the preference only if folder is open
    if (state.currentFolder) {
      await invoke("set_theme", {
        folderPath: state.currentFolder,
        themeName
      });
      console.log(`Switched to theme: ${themeName} (saved to .loom folder)`);
    } else {
      console.log(`Switched to theme: ${themeName} (not persisted - no folder open)`);
    }
  } catch (error) {
    console.error(`Failed to switch theme to '${themeName}':`, error);
    throw error;
  }
}

/**
 * Get a list of all available themes
 */
export async function getAvailableThemes(): Promise<string[]> {
  try {
    return await invoke<string[]>("get_available_themes", {
      folderPath: state.currentFolder
    });
  } catch (error) {
    console.error("Failed to get available themes:", error);
    return ["dark", "light"]; // Fallback to built-in themes
  }
}

/**
 * Import a custom theme from a file
 */
export async function importTheme(sourcePath: string): Promise<string> {
  try {
    if (!state.currentFolder) {
      throw new Error("Please open a folder before importing themes");
    }

    const themeName = await invoke<string>("import_custom_theme", {
      folderPath: state.currentFolder,
      sourcePath
    });

    // Refresh available themes
    const themes = await getAvailableThemes();
    state.availableThemes = themes;

    return themeName;
  } catch (error) {
    console.error("Failed to import theme:", error);
    throw error;
  }
}

/**
 * Export a theme to a file
 */
export async function exportTheme(themeName: string, destPath: string): Promise<void> {
  try {
    await invoke("export_custom_theme", {
      folderPath: state.currentFolder,
      themeName,
      destPath
    });
  } catch (error) {
    console.error("Failed to export theme:", error);
    throw error;
  }
}

/**
 * Get the current theme configuration
 */
export async function getCurrentTheme(): Promise<ThemeConfig> {
  try {
    return await invoke<ThemeConfig>("get_current_theme", {
      folderPath: state.currentFolder
    });
  } catch (error) {
    console.error("Failed to get current theme:", error);
    throw error;
  }
}

/**
 * Get the path to the .loom directory
 */
export async function getLoomDirectory(): Promise<string> {
  try {
    if (!state.currentFolder) {
      throw new Error("No folder is currently open");
    }
    return await invoke<string>("get_loom_directory", {
      folderPath: state.currentFolder
    });
  } catch (error) {
    console.error("Failed to get .loom directory:", error);
    throw error;
  }
}

/**
 * Populate a theme selector element with available themes
 */
export async function populateThemeSelector(selector: HTMLSelectElement): Promise<void> {
  try {
    const themes = await getAvailableThemes();
    state.availableThemes = themes;

    // Clear existing options
    selector.innerHTML = "";

    // Add theme options
    themes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme;
      option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
      selector.appendChild(option);
    });

    // Set current theme as selected
    selector.value = state.currentTheme;
  } catch (error) {
    console.error("Failed to populate theme selector:", error);
  }
}
