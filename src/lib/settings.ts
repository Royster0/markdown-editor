/**
 * Settings management module
 */

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { state } from "./state";
import { KeybindAction } from "./types";
import { switchTheme, importTheme, populateThemeSelector } from "./theme";
import {
  selectAll,
  undo,
  redo,
  copy,
  cut,
  paste,
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  insertLink,
  insertCode,
  insertCodeBlock,
  increaseHeadingLevel,
  decreaseHeadingLevel,
  openFind,
  openReplace,
  zoomIn,
  zoomOut,
  resetZoom
} from "./formatting";

// DOM element references
const settingsModal = document.getElementById("settings-modal") as HTMLElement;
const settingsCloseBtn = document.getElementById("settings-close") as HTMLButtonElement;
const settingsThemeSelector = document.getElementById("settings-theme-selector") as HTMLSelectElement;
const settingsImportThemeBtn = document.getElementById("settings-import-theme") as HTMLButtonElement;
const settingsStatusBarToggle = document.getElementById("settings-status-bar-toggle") as HTMLInputElement;
const settingsConfirmFileDeleteToggle = document.getElementById("settings-confirm-file-delete") as HTMLInputElement;
const settingsConfirmFolderDeleteToggle = document.getElementById("settings-confirm-folder-delete") as HTMLInputElement;
const keybindsList = document.getElementById("keybinds-list") as HTMLElement;
const statusBar = document.querySelector(".status-bar") as HTMLElement;

// Define available keybind actions
export const KEYBIND_ACTIONS: KeybindAction[] = [
  // File operations
  {
    id: "save-file",
    name: "Save File",
    description: "Save the current file",
    defaultKey: "Ctrl+S",
    category: "File"
  },
  {
    id: "open-file",
    name: "Open File",
    description: "Open a file",
    defaultKey: "Ctrl+O",
    category: "File"
  },
  {
    id: "new-file",
    name: "New File",
    description: "Create a new file",
    defaultKey: "Ctrl+N",
    category: "File"
  },
  {
    id: "open-folder",
    name: "Open Folder",
    description: "Open a folder",
    defaultKey: "Ctrl+K Ctrl+O",
    category: "File"
  },

  // Editing
  {
    id: "toggle-edit-mode",
    name: "Toggle Edit Mode",
    description: "Toggle markdown edit mode",
    defaultKey: "Ctrl+E",
    category: "Editing"
  },
  {
    id: "select-all",
    name: "Select All",
    description: "Select all text",
    defaultKey: "Ctrl+A",
    category: "Editing"
  },
  {
    id: "undo",
    name: "Undo",
    description: "Undo last action",
    defaultKey: "Ctrl+Z",
    category: "Editing"
  },
  {
    id: "redo",
    name: "Redo",
    description: "Redo last undone action",
    defaultKey: "Ctrl+Y",
    category: "Editing"
  },
  {
    id: "copy",
    name: "Copy",
    description: "Copy selection",
    defaultKey: "Ctrl+C",
    category: "Editing"
  },
  {
    id: "cut",
    name: "Cut",
    description: "Cut selection",
    defaultKey: "Ctrl+X",
    category: "Editing"
  },
  {
    id: "paste",
    name: "Paste",
    description: "Paste from clipboard",
    defaultKey: "Ctrl+V",
    category: "Editing"
  },
  {
    id: "find",
    name: "Find",
    description: "Find in document",
    defaultKey: "Ctrl+F",
    category: "Editing"
  },
  {
    id: "replace",
    name: "Replace",
    description: "Find and replace",
    defaultKey: "Ctrl+H",
    category: "Editing"
  },

  // Formatting
  {
    id: "bold",
    name: "Bold",
    description: "Make text bold",
    defaultKey: "Ctrl+B",
    category: "Formatting"
  },
  {
    id: "italic",
    name: "Italic",
    description: "Make text italic",
    defaultKey: "Ctrl+I",
    category: "Formatting"
  },
  {
    id: "strikethrough",
    name: "Strikethrough",
    description: "Strikethrough text",
    defaultKey: "Ctrl+Shift+X",
    category: "Formatting"
  },
  {
    id: "insert-link",
    name: "Insert Link",
    description: "Insert a hyperlink",
    defaultKey: "Ctrl+K",
    category: "Formatting"
  },
  {
    id: "insert-code",
    name: "Insert Code",
    description: "Insert inline code",
    defaultKey: "Ctrl+`",
    category: "Formatting"
  },
  {
    id: "insert-code-block",
    name: "Insert Code Block",
    description: "Insert code block",
    defaultKey: "Ctrl+Shift+`",
    category: "Formatting"
  },
  {
    id: "increase-heading",
    name: "Increase Heading Level",
    description: "Make heading larger",
    defaultKey: "Ctrl+Shift+]",
    category: "Formatting"
  },
  {
    id: "decrease-heading",
    name: "Decrease Heading Level",
    description: "Make heading smaller",
    defaultKey: "Ctrl+Shift+[",
    category: "Formatting"
  },

  // View
  {
    id: "toggle-sidebar",
    name: "Toggle Sidebar",
    description: "Show/hide sidebar",
    defaultKey: "Ctrl+\\",
    category: "View"
  },
  {
    id: "toggle-status-bar",
    name: "Toggle Status Bar",
    description: "Show/hide status bar",
    defaultKey: "Ctrl+Shift+B",
    category: "View"
  },
  {
    id: "zoom-in",
    name: "Zoom In",
    description: "Increase zoom level",
    defaultKey: "Ctrl+=",
    category: "View"
  },
  {
    id: "zoom-out",
    name: "Zoom Out",
    description: "Decrease zoom level",
    defaultKey: "Ctrl+-",
    category: "View"
  },
  {
    id: "reset-zoom",
    name: "Reset Zoom",
    description: "Reset zoom to 100%",
    defaultKey: "Ctrl+0",
    category: "View"
  },

  // Window
  {
    id: "settings",
    name: "Open Settings",
    description: "Open settings modal",
    defaultKey: "Ctrl+,",
    category: "Window"
  },
  {
    id: "close-window",
    name: "Close Window",
    description: "Close the window",
    defaultKey: "Ctrl+W",
    category: "Window"
  },
  {
    id: "minimize-window",
    name: "Minimize Window",
    description: "Minimize the window",
    defaultKey: "Ctrl+Shift+M",
    category: "Window"
  },
  {
    id: "maximize-window",
    name: "Maximize Window",
    description: "Maximize the window",
    defaultKey: "F11",
    category: "Window"
  }
];

/**
 * Initialize settings module
 */
export async function initializeSettings(): Promise<void> {
  // Load settings from backend
  await loadSettings();

  // Set up event listeners
  setupEventListeners();

  // Populate theme selector
  populateThemeSelector(settingsThemeSelector);

  // Populate keybinds list
  populateKeybindsList();

  // Apply initial state
  applyStatusBarVisibility();
}

/**
 * Load settings from backend
 */
async function loadSettings(): Promise<void> {
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
      if (settingsConfirmFileDeleteToggle) {
        settingsConfirmFileDeleteToggle.checked = config.confirm_file_delete;
      }
    }

    if (config.confirm_folder_delete !== undefined) {
      state.confirmFolderDelete = config.confirm_folder_delete;
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
    if (settingsConfirmFileDeleteToggle) {
      settingsConfirmFileDeleteToggle.checked = true;
    }
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
  if (!settingsModal.classList.contains("hidden")) {
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
 * Set up event listeners
 */
function setupEventListeners(): void {
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
 * Apply status bar visibility
 */
function applyStatusBarVisibility(): void {
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

/**
 * Populate keybinds list
 */
function populateKeybindsList(): void {
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
    startRecordingKeybind(action, display);
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

/**
 * Start recording a new keybind
 */
function startRecordingKeybind(action: KeybindAction, display: HTMLElement): void {
  display.classList.add("recording");
  display.textContent = "Press keys...";

  const recordKeybind = async (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Build keybind string
    const keys: string[] = [];
    if (e.ctrlKey || e.metaKey) keys.push("Ctrl");
    if (e.altKey) keys.push("Alt");
    if (e.shiftKey) keys.push("Shift");

    // Add the main key
    if (e.key !== "Control" && e.key !== "Alt" && e.key !== "Shift" && e.key !== "Meta") {
      let key = e.key;

      // Format special keys
      if (key === " ") key = "Space";
      else if (key.length === 1) key = key.toUpperCase();

      keys.push(key);

      // Save the keybind
      const keybindString = keys.join("+");
      state.keybinds[action.id] = keybindString;
      display.textContent = keybindString;
      display.classList.remove("recording");

      await saveSettings();

      // Remove listener
      document.removeEventListener("keydown", recordKeybind);
    }
  };

  // Listen for key press
  document.addEventListener("keydown", recordKeybind);

  // Cancel on escape
  const cancelRecording = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      display.classList.remove("recording");
      display.textContent = state.keybinds[action.id] || action.defaultKey;
      document.removeEventListener("keydown", recordKeybind);
      document.removeEventListener("keydown", cancelRecording);
    }
  };
  document.addEventListener("keydown", cancelRecording);
}

/**
 * Handle global keybind
 */
function handleGlobalKeybind(e: KeyboardEvent): void {
  // Don't handle keybinds while recording
  const recordingElement = document.querySelector(".keybind-display.recording");
  if (recordingElement) return;

  // Build current key combination
  const keys: string[] = [];
  if (e.ctrlKey || e.metaKey) keys.push("Ctrl");
  if (e.altKey) keys.push("Alt");
  if (e.shiftKey) keys.push("Shift");

  if (e.key !== "Control" && e.key !== "Alt" && e.key !== "Shift" && e.key !== "Meta") {
    let key = e.key;
    if (key === " ") key = "Space";
    else if (key.length === 1) key = key.toUpperCase();
    keys.push(key);
  } else {
    return; // Only modifier pressed
  }

  const currentKeybind = keys.join("+");

  // Actions that should use native browser behavior
  const nativeActions = ["find", "replace"];

  // Find matching action
  for (const action of KEYBIND_ACTIONS) {
    const actionKeybind = state.keybinds[action.id] || action.defaultKey;
    if (actionKeybind === currentKeybind) {
      // For native actions, don't prevent default to allow native browser behavior
      if (!nativeActions.includes(action.id)) {
        e.preventDefault();
      }
      executeKeybindAction(action.id);
      break;
    }
  }
}

/**
 * Execute a keybind action
 */
async function executeKeybindAction(actionId: string): Promise<void> {
  switch (actionId) {
    // File operations
    case "save-file":
      document.getElementById("file-menu-save-file")?.click();
      break;
    case "open-file":
      document.getElementById("file-menu-open-file")?.click();
      break;
    case "new-file":
      document.getElementById("file-menu-new-file")?.click();
      break;
    case "open-folder":
      document.getElementById("file-menu-open-folder")?.click();
      break;

    // Editing operations
    case "toggle-edit-mode":
      document.getElementById("edit-mode-toggle")?.click();
      break;
    case "select-all":
      selectAll();
      break;
    case "undo":
      undo();
      break;
    case "redo":
      redo();
      break;
    case "copy":
      copy();
      break;
    case "cut":
      cut();
      break;
    case "paste":
      paste();
      break;
    case "find":
      openFind();
      break;
    case "replace":
      openReplace();
      break;

    // Formatting operations
    case "bold":
      toggleBold();
      break;
    case "italic":
      toggleItalic();
      break;
    case "strikethrough":
      toggleStrikethrough();
      break;
    case "insert-link":
      insertLink();
      break;
    case "insert-code":
      insertCode();
      break;
    case "insert-code-block":
      insertCodeBlock();
      break;
    case "increase-heading":
      increaseHeadingLevel();
      break;
    case "decrease-heading":
      decreaseHeadingLevel();
      break;

    // View operations
    case "toggle-sidebar":
      document.getElementById("toggle-sidebar-titlebar")?.click();
      break;
    case "toggle-status-bar":
      await toggleStatusBar();
      break;
    case "zoom-in":
      zoomIn();
      break;
    case "zoom-out":
      zoomOut();
      break;
    case "reset-zoom":
      resetZoom();
      break;

    // Window operations
    case "settings":
      openSettings();
      break;
    case "close-window":
      document.getElementById("window-close")?.click();
      break;
    case "minimize-window":
      document.getElementById("window-minimize")?.click();
      break;
    case "maximize-window":
      document.getElementById("window-maximize")?.click();
      break;

    default:
      console.log(`Action not implemented: ${actionId}`);
  }
}
