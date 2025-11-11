/**
 * Settings UI module
 * Handles settings modal UI and keybinds list rendering
 */

import { open } from "@tauri-apps/plugin-dialog";
import { state } from "../core/state";
import { KeybindAction } from "../core/types";
import { switchTheme, importTheme, populateThemeSelector } from "./theme";
import { KEYBIND_ACTIONS, startRecordingKeybind, handleGlobalKeybind } from "./keybinds";
import { saveSettings, applyStatusBarVisibility } from "./settings-manager";

// DOM element references
const settingsModal = document.getElementById("settings-modal") as HTMLElement;
const settingsCloseBtn = document.getElementById("settings-close") as HTMLButtonElement;
const settingsThemeSelector = document.getElementById("settings-theme-selector") as HTMLSelectElement;
const settingsImportThemeBtn = document.getElementById("settings-import-theme") as HTMLButtonElement;
const settingsStatusBarToggle = document.getElementById("settings-status-bar-toggle") as HTMLInputElement;
const settingsConfirmFileDeleteToggle = document.getElementById("settings-confirm-file-delete") as HTMLInputElement;
const settingsConfirmFolderDeleteToggle = document.getElementById("settings-confirm-folder-delete") as HTMLInputElement;
const keybindsList = document.getElementById("keybinds-list") as HTMLElement;

/**
 * Set up event listeners for settings UI
 */
export function setupSettingsEventListeners(): void {
  // Settings button in file menu
  const fileMenuSettingsBtn = document.getElementById("file-menu-settings");
  if (fileMenuSettingsBtn) {
    fileMenuSettingsBtn.addEventListener("click", openSettings);
  }

  // Close button
  settingsCloseBtn.addEventListener("click", closeSettings);

  // Backdrop click
  const backdrop = settingsModal.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", closeSettings);
  }

  // Theme selector
  settingsThemeSelector.addEventListener("change", async () => {
    const themeName = settingsThemeSelector.value;
    await switchTheme(themeName);
    await saveSettings();
  });

  // Import theme button
  settingsImportThemeBtn.addEventListener("click", async () => {
    try {
      if (!state.currentFolder) {
        alert("Please open a folder before importing themes");
        return;
      }

      const selected = await open({
        title: "Select Theme File",
        multiple: false,
        filters: [{
          name: "JSON",
          extensions: ["json"]
        }]
      });

      if (selected && typeof selected === "string") {
        const themeName = await importTheme(selected);
        await populateThemeSelector(settingsThemeSelector);
        alert(`Theme "${themeName}" imported successfully!`);
      }
    } catch (error) {
      console.error("Failed to import theme:", error);
      alert("Failed to import theme. Please check the console for details.");
    }
  });

  // Status bar toggle
  settingsStatusBarToggle.addEventListener("change", async () => {
    state.statusBarVisible = settingsStatusBarToggle.checked;
    applyStatusBarVisibility();
    await saveSettings();
  });

  // Confirm file delete toggle
  if (settingsConfirmFileDeleteToggle) {
    settingsConfirmFileDeleteToggle.addEventListener("change", async () => {
      state.confirmFileDelete = settingsConfirmFileDeleteToggle.checked;
      await saveSettings();
    });
  }

  // Confirm folder delete toggle
  if (settingsConfirmFolderDeleteToggle) {
    settingsConfirmFolderDeleteToggle.addEventListener("change", async () => {
      state.confirmFolderDelete = settingsConfirmFolderDeleteToggle.checked;
      await saveSettings();
    });
  }

  // Escape key to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !settingsModal.classList.contains("hidden")) {
      closeSettings();
    }
  });

  // Global keybind handler
  document.addEventListener("keydown", handleGlobalKeybind);
}

/**
 * Open settings modal
 */
export function openSettings(): void {
  settingsModal.classList.remove("hidden");

  // Update theme selector to current theme
  settingsThemeSelector.value = state.currentTheme;

  // Update status bar toggle
  settingsStatusBarToggle.checked = state.statusBarVisible;

  // Update delete confirmation toggles
  if (settingsConfirmFileDeleteToggle) {
    settingsConfirmFileDeleteToggle.checked = state.confirmFileDelete;
  }
  if (settingsConfirmFolderDeleteToggle) {
    settingsConfirmFolderDeleteToggle.checked = state.confirmFolderDelete;
  }

  // Refresh keybinds list
  populateKeybindsList();
}

/**
 * Close settings modal
 */
export function closeSettings(): void {
  settingsModal.classList.add("hidden");
}

/**
 * Populate keybinds list
 */
export function populateKeybindsList(): void {
  keybindsList.innerHTML = "";

  // Group by category
  const categories = new Map<string, KeybindAction[]>();
  KEYBIND_ACTIONS.forEach(action => {
    if (!categories.has(action.category)) {
      categories.set(action.category, []);
    }
    categories.get(action.category)!.push(action);
  });

  // Render each category
  categories.forEach((actions, category) => {
    // Category header
    const categoryHeader = document.createElement("div");
    categoryHeader.className = "keybind-category-header";
    categoryHeader.style.cssText = "font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 16px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color);";
    if (category === "File" || category === "Editing") {
      categoryHeader.style.marginTop = "0";
    }
    categoryHeader.textContent = category;
    keybindsList.appendChild(categoryHeader);

    // Render actions
    actions.forEach(action => {
      const item = createKeybindItem(action);
      keybindsList.appendChild(item);
    });
  });
}

/**
 * Create a keybind item element
 */
function createKeybindItem(action: KeybindAction): HTMLElement {
  const item = document.createElement("div");
  item.className = "keybind-item";

  const info = document.createElement("div");
  info.className = "keybind-info";

  const name = document.createElement("div");
  name.className = "keybind-name";
  name.textContent = action.name;

  const description = document.createElement("div");
  description.className = "keybind-description";
  description.textContent = action.description;

  info.appendChild(name);
  info.appendChild(description);

  const inputContainer = document.createElement("div");
  inputContainer.className = "keybind-input";

  const display = document.createElement("div");
  display.className = "keybind-display";
  display.textContent = state.keybinds[action.id] || action.defaultKey;
  display.title = "Click to change keybind";

  // Click to record new keybind
  display.addEventListener("click", () => {
    startRecordingKeybind(action, display, saveSettings);
  });

  const resetBtn = document.createElement("button");
  resetBtn.className = "keybind-reset";
  resetBtn.title = "Reset to default";
  resetBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
      <path d="M21 3v5h-5"></path>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
      <path d="M3 21v-5h5"></path>
    </svg>
  `;

  resetBtn.addEventListener("click", async () => {
    state.keybinds[action.id] = action.defaultKey;
    display.textContent = action.defaultKey;
    await saveSettings();
  });

  inputContainer.appendChild(display);
  inputContainer.appendChild(resetBtn);

  item.appendChild(info);
  item.appendChild(inputContainer);

  return item;
}
