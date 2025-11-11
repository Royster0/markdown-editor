/**
 * Welcome screen functionality
 * Shows when no folder is loaded
 */

import { state } from "./state";
import { openFolder, refreshFileTree } from "./file-tree";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { explorerHeader, sidebar } from "./dom";
import { reinitializeThemeForFolder } from "./theme";
import { reinitializeSettingsForFolder } from "./settings";

let welcomeScreenElement: HTMLElement | null = null;

/**
 * Create folder in a specific location
 */
async function createFolderInLocation() {
  try {
    // First, let user pick a parent directory
    const parentDir = await open({
      directory: true,
      multiple: false,
      title: "Select location for new folder",
    });

    if (!parentDir || typeof parentDir !== "string") {
      return;
    }

    // Prompt for folder name
    const folderName = prompt("Enter folder name:");
    if (!folderName) return;

    // Sanitize folder name
    const sanitizedName = folderName.replace(/[<>:"/\\|?*]/g, "");
    if (!sanitizedName) {
      alert("Invalid folder name");
      return;
    }

    // Create the folder path
    const separator = parentDir.includes("\\") ? "\\" : "/";
    const newFolderPath = `${parentDir}${separator}${sanitizedName}`;

    // Create the folder using Tauri backend
    await invoke("create_folder", { path: newFolderPath });

    // Open the newly created folder
    state.currentFolder = newFolderPath;
    hideWelcomeScreen();

    // Show the sidebar
    state.sidebarVisible = true;
    sidebar.classList.remove("collapsed");

    // Reload the file tree
    await refreshFileTree();
    await reinitializeThemeForFolder();
    await reinitializeSettingsForFolder();

    // Update explorer header
    const folderName_display = newFolderPath.split(/[\\/]/).pop() || "EXPLORER";
    explorerHeader.textContent = folderName_display.toUpperCase();
  } catch (error) {
    console.error("Error creating folder:", error);
    alert("Failed to create folder");
  }
}

/**
 * Show the welcome screen
 */
export function showWelcomeScreen() {
  if (!welcomeScreenElement) {
    createWelcomeScreen();
  }

  if (welcomeScreenElement) {
    welcomeScreenElement.classList.remove("hidden");
  }

  // Hide the sidebar when showing welcome screen
  state.sidebarVisible = false;
  sidebar.classList.add("collapsed");
}

/**
 * Hide the welcome screen
 */
export function hideWelcomeScreen() {
  if (welcomeScreenElement) {
    welcomeScreenElement.classList.add("hidden");
  }
}

/**
 * Create the welcome screen DOM element
 */
function createWelcomeScreen() {
  const editorContainer = document.querySelector(".editor-container");
  if (!editorContainer) {
    console.error("Editor container not found");
    return;
  }

  welcomeScreenElement = document.createElement("div");
  welcomeScreenElement.id = "welcome-screen";
  welcomeScreenElement.className = "welcome-screen";
  welcomeScreenElement.innerHTML = `
    <div class="welcome-content">
      <div class="welcome-header">
        <svg class="welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <h1>Welcome to Markdown Editor</h1>
        <p class="welcome-subtitle">Get started by opening a folder or creating a new one</p>
      </div>

      <div class="welcome-actions">
        <button id="welcome-open-folder" class="welcome-btn welcome-btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Open Folder</span>
        </button>

        <button id="welcome-create-folder" class="welcome-btn welcome-btn-secondary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            <line x1="12" y1="11" x2="12" y2="17"></line>
            <line x1="9" y1="14" x2="15" y2="14"></line>
          </svg>
          <span>Create New Folder</span>
        </button>
      </div>
    </div>
  `;

  // Insert before the toolbar
  editorContainer.insertBefore(welcomeScreenElement, editorContainer.firstChild);

  // Add event listeners
  const openFolderBtn = welcomeScreenElement.querySelector("#welcome-open-folder");
  const createFolderBtn = welcomeScreenElement.querySelector("#welcome-create-folder");

  openFolderBtn?.addEventListener("click", async () => {
    await openFolder();
    // Hide welcome screen if folder was opened
    if (state.currentFolder) {
      hideWelcomeScreen();
    }
  });

  createFolderBtn?.addEventListener("click", async () => {
    await createFolderInLocation();
  });
}

/**
 * Initialize welcome screen
 * Show it if no folder is currently loaded
 */
export function initWelcomeScreen() {
  createWelcomeScreen();

  // Show welcome screen if no folder is loaded
  if (!state.currentFolder) {
    showWelcomeScreen();
    // Sidebar is already hidden by showWelcomeScreen()
  } else {
    hideWelcomeScreen();
    // Ensure sidebar is visible if folder is loaded
    state.sidebarVisible = true;
    sidebar.classList.remove("collapsed");
  }
}

/**
 * Check if welcome screen should be shown based on current state
 */
export function checkWelcomeScreenState() {
  if (!state.currentFolder && !state.currentFile) {
    showWelcomeScreen();
  } else {
    hideWelcomeScreen();
  }
}
