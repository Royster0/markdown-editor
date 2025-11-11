/**
 * Markdown Editor - Main Entry Point
 *
 * This is a modular markdown editor built with TypeScript, Tauri, and Rust.
 * The application provides live markdown preview with LaTeX support.
 */

import "./lib/types";
import { state } from "./lib/state";
import { updateStatistics, updateCursorPosition } from "./lib/ui";
import { initEditorEvents } from "./lib/editor";
import { initWindowControls } from "./lib/window-controls";
import { initializeTheme } from "./lib/theme";
import { initializeSettings } from "./lib/settings";
import { initFileTree } from "./lib/file-tree";
import { initWelcomeScreen, hideWelcomeScreen } from "./lib/welcome-screen";
import { initTabs, openInTab, closeTab, getTabs } from "./lib/tabs";
import { readTextFile } from "@tauri-apps/plugin-fs";

/**
 * Check if a file path was passed via URL parameters and open it
 */
async function checkAndOpenFileFromUrl(): Promise<boolean> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const filePath = urlParams.get("file");

    if (filePath) {
      console.log("Opening file from URL parameter:", filePath);
      const decodedPath = decodeURIComponent(filePath);

      // Read the file content
      const content = await readTextFile(decodedPath);

      // Open it in a new tab
      await openInTab(decodedPath, content);

      // Hide the welcome screen since we have a file open
      hideWelcomeScreen();

      console.log("File opened successfully:", decodedPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to open file from URL parameter:", error);
    alert(`Failed to open file: ${error}`);
    return false;
  }
}

/**
 * Initialize the application
 */
async function initialize() {
  // Initialize theme system first (loads saved theme preference)
  await initializeTheme();

  // Initialize settings system
  await initializeSettings();

  // Initialize tab system (this will create the initial default tab)
  initTabs();

  // Initialize event handlers
  initEditorEvents();
  initWindowControls();
  initFileTree();
  initWelcomeScreen();

  // Initialize UI
  updateStatistics(state.content);
  updateCursorPosition();

  // Check if a file should be opened from URL parameters
  const fileWasOpened = await checkAndOpenFileFromUrl();

  // If a file was opened from URL, close the default empty tab
  if (fileWasOpened) {
    const tabs = getTabs();

    // Close the first tab (the default empty one) if we have 2 tabs
    // The first tab should be empty, the second is our file
    if (tabs.length === 2 && tabs[0].filePath === null && tabs[0].content === "") {
      await closeTab(0);
    }
  }

  console.log("Markdown Editor initialized successfully");
}

// Start the application
initialize().catch((error) => {
  console.error("Failed to initialize application:", error);
});
