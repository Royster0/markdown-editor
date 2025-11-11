/**
 * Settings manager module
 * Handles settings persistence and state management
 */

import { invoke } from "@tauri-apps/api/core";
import { state } from "../core/state";
import { KEYBIND_ACTIONS } from "./keybinds";

// DOM element references
const settingsStatusBarToggle = document.getElementById("settings-status-bar-toggle") as HTMLInputElement;
const statusBar = document.querySelector(".status-bar") as HTMLElement;

/**
 * Load settings from backend
 */
export async function loadSettings(): Promise<void> {
  try {
    const config = await invoke<any>("get_config", {
      folderPath: state.currentFolder
    });

    // Load status bar visibility
    if (config.status_bar_visible !== undefined) {
      state.statusBarVisible = config.status_bar_visible;
      if (settingsStatusBarToggle) {
        settingsStatusBarToggle.checked = config.status_bar_visible;
      }
    }

    // Load delete confirmation settings
    if (config.confirm_file_delete !== undefined) {
      state.confirmFileDelete = config.confirm_file_delete;
      const settingsConfirmFileDeleteToggle = document.getElementById("settings-confirm-file-delete") as HTMLInputElement;
      if (settingsConfirmFileDeleteToggle) {
        settingsConfirmFileDeleteToggle.checked = config.confirm_file_delete;
      }
    }

    if (config.confirm_folder_delete !== undefined) {
      state.confirmFolderDelete = config.confirm_folder_delete;
      const settingsConfirmFolderDeleteToggle = document.getElementById("settings-confirm-folder-delete") as HTMLInputElement;
      if (settingsConfirmFolderDeleteToggle) {
        settingsConfirmFolderDeleteToggle.checked = config.confirm_folder_delete;
      }
    }

    // Load keybinds
    if (config.keybinds && Object.keys(config.keybinds).length > 0) {
      state.keybinds = config.keybinds;
    } else {
      // Use default keybinds
      state.keybinds = {};
      KEYBIND_ACTIONS.forEach(action => {
        state.keybinds[action.id] = action.defaultKey;
      });
    }
  } catch (error) {
    console.error("Failed to load settings:", error);

    // Use defaults
    state.statusBarVisible = true;
    state.confirmFileDelete = true;
    state.confirmFolderDelete = true;
    if (settingsStatusBarToggle) {
      settingsStatusBarToggle.checked = true;
    }
    const settingsConfirmFileDeleteToggle = document.getElementById("settings-confirm-file-delete") as HTMLInputElement;
    if (settingsConfirmFileDeleteToggle) {
      settingsConfirmFileDeleteToggle.checked = true;
    }
    const settingsConfirmFolderDeleteToggle = document.getElementById("settings-confirm-folder-delete") as HTMLInputElement;
    if (settingsConfirmFolderDeleteToggle) {
      settingsConfirmFolderDeleteToggle.checked = true;
    }
    state.keybinds = {};
    KEYBIND_ACTIONS.forEach(action => {
      state.keybinds[action.id] = action.defaultKey;
    });
  }
}

/**
 * Reinitialize settings for a newly opened folder
 * Call this when a folder is opened to load its specific settings
 */
export async function reinitializeSettingsForFolder(): Promise<void> {
  await loadSettings();
  applyStatusBarVisibility();
  // Refresh keybinds list if settings modal is open
  const settingsModal = document.getElementById("settings-modal") as HTMLElement;
  if (!settingsModal.classList.contains("hidden")) {
    const { populateKeybindsList } = await import("./settings-ui");
    populateKeybindsList();
  }
}

/**
 * Save settings to backend
 */
export async function saveSettings(): Promise<void> {
  try {
    await invoke("update_config", {
      folderPath: state.currentFolder,
      config: {
        current_theme: state.currentTheme,
        status_bar_visible: state.statusBarVisible,
        confirm_file_delete: state.confirmFileDelete,
        confirm_folder_delete: state.confirmFolderDelete,
        keybinds: state.keybinds,
        custom_settings: {}
      }
    });
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

/**
 * Apply status bar visibility
 */
export function applyStatusBarVisibility(): void {
  if (state.statusBarVisible) {
    statusBar.classList.remove("hidden");
  } else {
    statusBar.classList.add("hidden");
  }
}

/**
 * Toggle status bar visibility
 */
export async function toggleStatusBar(): Promise<void> {
  state.statusBarVisible = !state.statusBarVisible;
  settingsStatusBarToggle.checked = state.statusBarVisible;
  applyStatusBarVisibility();
  await saveSettings();
}
