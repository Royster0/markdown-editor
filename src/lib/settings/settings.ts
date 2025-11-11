/**
 * Settings module - Main orchestrator
 * Coordinates settings management, UI, and keybinds
 */

import { populateThemeSelector } from "./theme";
import { loadSettings, applyStatusBarVisibility } from "./settings-manager";
import { setupSettingsEventListeners, populateKeybindsList } from "./settings-ui";

// Re-export for backward compatibility
export { KEYBIND_ACTIONS } from "./keybinds";
export { saveSettings, reinitializeSettingsForFolder, toggleStatusBar } from "./settings-manager";
export { openSettings, closeSettings } from "./settings-ui";

/**
 * Initialize settings module
 */
export async function initializeSettings(): Promise<void> {
  // Load settings from backend
  await loadSettings();

  // Set up event listeners
  setupSettingsEventListeners();

  // Populate theme selector
  const settingsThemeSelector = document.getElementById("settings-theme-selector") as HTMLSelectElement;
  populateThemeSelector(settingsThemeSelector);

  // Populate keybinds list
  populateKeybindsList();

  // Apply initial state
  applyStatusBarVisibility();
}
