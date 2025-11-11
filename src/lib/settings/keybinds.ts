/**
 * Keybinds management module
 * Handles keybind definitions, recording, and execution
 */

import { state } from "../core/state";
import { KeybindAction } from "../core/types";
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
} from "../formatting/formatting";
import { toggleStatusBar } from "./settings-manager";

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
 * Start recording a new keybind
 */
export function startRecordingKeybind(
  action: KeybindAction,
  display: HTMLElement,
  saveCallback: () => Promise<void>
): void {
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

      await saveCallback();

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
export function handleGlobalKeybind(e: KeyboardEvent): void {
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
      // Import dynamically to avoid circular dependency
      const { openSettings } = await import("./settings-ui");
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
