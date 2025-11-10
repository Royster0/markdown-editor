/**
 * File tree sidebar functionality
 */

import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { FileEntry } from "./types";
import { fileTree, sidebar, explorerHeader } from "./dom";
import { state } from "./state";
import { loadFileContent } from "./file-operations";
import { reinitializeThemeForFolder } from "./theme";
import { showContextMenu, initContextMenu } from "./context-menu";

/**
 * Update the explorer header to show the current folder name
 */
function updateExplorerHeader() {
  if (state.currentFolder) {
    // Extract folder name from path
    const folderName = state.currentFolder.split(/[\\/]/).pop() || "EXPLORER";
    explorerHeader.textContent = folderName.toUpperCase();
  } else {
    explorerHeader.textContent = "EXPLORER";
  }
}

/**
 * Open folder dialog and load file tree
 */
export async function openFolder() {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
    });

    if (selected && typeof selected === "string") {
      state.currentFolder = selected;
      updateExplorerHeader();
      await loadFileTree(selected);
      // Reinitialize theme system for the new folder
      await reinitializeThemeForFolder();
    }
  } catch (error) {
    console.error("Error opening folder:", error);
  }
}

/**
 * Load and render file tree for a folder path
 * @param folderPath - Path to the folder
 */
async function loadFileTree(folderPath: string) {
  try {
    const entries = await invoke<FileEntry[]>("read_directory", {
      path: folderPath,
    });
    renderFileTree(entries);
  } catch (error) {
    console.error("Error loading file tree:", error);
    fileTree.innerHTML = `
      <div class="empty-state">
        <p>Error loading folder</p>
        <button id="open-folder-sidebar-retry" class="open-folder-btn">Try Again</button>
      </div>
    `;
    document
      .getElementById("open-folder-sidebar-retry")
      ?.addEventListener("click", openFolder);
  }
}

// Track expanded folders to preserve state during refresh
const expandedFolders = new Set<string>();

/**
 * Refresh the file tree (reload current folder)
 */
export async function refreshFileTree() {
  if (state.currentFolder) {
    await loadFileTree(state.currentFolder);
  }
}

/**
 * Refresh file tree and try to expand to show a specific file
 * @param filePath - Path to the file to reveal
 */
export async function refreshAndRevealFile(filePath: string) {
  await refreshFileTree();

  // Try to find and expand parent folders to show the file
  // This is a simple implementation that works for root-level files
  // For nested files, we'd need more complex logic
  if (state.currentFolder) {
    // Get all tree items
    const treeItems = fileTree.querySelectorAll(".tree-item");
    treeItems.forEach((item) => {
      const itemPath = item.getAttribute("data-path");
      if (itemPath === filePath) {
        // Select and scroll to the item
        item.classList.add("selected");
        item.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
}

/**
 * Context menu handler for empty space in file tree
 */
function handleFileTreeContextMenu(e: MouseEvent) {
  // Only trigger if clicking directly on fileTree (not on tree items)
  if (e.target === fileTree) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, null, false);
  }
}

/**
 * Render file tree from entries
 * @param entries - Array of file entries
 */
function renderFileTree(entries: FileEntry[]) {
  fileTree.innerHTML = "";

  entries.forEach((entry) => {
    const treeItem = createTreeItem(entry);
    fileTree.appendChild(treeItem);
  });
}

/**
 * Create a tree item element
 * @param entry - File entry to create item for
 * @param level - Nesting level for indentation
 * @returns HTMLElement representing the tree item
 */
function createTreeItem(entry: FileEntry, level: number = 0): HTMLElement {
  const container = document.createElement("div");

  const item = document.createElement("div");
  item.className = "tree-item";
  item.style.paddingLeft = `${level * 16 + 8}px`;
  item.setAttribute("data-path", entry.path);
  item.setAttribute("data-is-dir", entry.is_dir.toString());

  // Arrow for folders
  if (entry.is_dir) {
    const arrow = document.createElement("span");
    arrow.className = "tree-item-arrow";
    arrow.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 4 10 8 6 12"></polyline>
      </svg>
    `;
    item.appendChild(arrow);
  } else {
    // Empty space for files to align with folders
    const spacer = document.createElement("span");
    spacer.className = "tree-item-arrow";
    item.appendChild(spacer);
  }

  // Icon
  const icon = document.createElement("span");
  icon.className = "tree-item-icon";
  if (entry.is_dir) {
    icon.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 3h4l1 2h7v9H2z"></path>
      </svg>
    `;
  } else {
    icon.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 1h7l3 3v10H3z"></path>
        <polyline points="10 1 10 4 13 4"></polyline>
      </svg>
    `;
  }
  item.appendChild(icon);

  // Name
  const name = document.createElement("span");
  name.className = "tree-item-name";
  name.textContent = entry.name;
  item.appendChild(name);

  container.appendChild(item);

  // Right-click handler for context menu
  item.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, entry.path, entry.is_dir);
  });

  // Children container for folders
  if (entry.is_dir) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "tree-children collapsed";
    container.appendChild(childrenContainer);

    // Click handler for folders
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      await toggleFolder(item, childrenContainer, entry, level);
    });
  } else {
    // Click handler for files
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      await loadFileContent(entry.path);

      // Update selection
      document
        .querySelectorAll(".tree-item")
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
    });
  }

  return container;
}

/**
 * Toggle folder expand/collapse
 * @param item - The folder item element
 * @param childrenContainer - Container for folder children
 * @param entry - File entry for the folder
 * @param level - Nesting level
 */
async function toggleFolder(
  item: HTMLElement,
  childrenContainer: HTMLElement,
  entry: FileEntry,
  level: number
) {
  const arrow = item.querySelector(".tree-item-arrow");
  const isCollapsed = childrenContainer.classList.contains("collapsed");

  if (isCollapsed) {
    // Expand folder
    childrenContainer.classList.remove("collapsed");
    arrow?.classList.add("expanded");
    expandedFolders.add(entry.path);

    // Load children if not already loaded
    if (childrenContainer.children.length === 0) {
      try {
        const children = await invoke<FileEntry[]>("read_directory", {
          path: entry.path,
        });
        children.forEach((childEntry: FileEntry) => {
          const childItem = createTreeItem(childEntry, level + 1);
          childrenContainer.appendChild(childItem);
        });
      } catch (error) {
        console.error("Error loading folder contents:", error);
      }
    }
  } else {
    // Collapse folder
    childrenContainer.classList.add("collapsed");
    arrow?.classList.remove("expanded");
    expandedFolders.delete(entry.path);
  }
}

/**
 * Toggle sidebar visibility
 */
export function toggleSidebar() {
  state.sidebarVisible = !state.sidebarVisible;
  if (state.sidebarVisible) {
    sidebar.classList.remove("collapsed");
  } else {
    sidebar.classList.add("collapsed");
  }
}

/**
 * Initialize sidebar resizing functionality
 */
export function initSidebarResize() {
  // Create resize handle
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "sidebar-resize-handle";
  sidebar.appendChild(resizeHandle);

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    resizeHandle.classList.add("resizing");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const delta = e.clientX - startX;
    const newWidth = startWidth + delta;

    // Enforce min and max width
    const minWidth = 150;
    const maxWidth = 600;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    sidebar.style.width = `${clampedWidth}px`;
    sidebar.style.minWidth = `${clampedWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      resizeHandle.classList.remove("resizing");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}

/**
 * Initialize file tree functionality
 */
export function initFileTree() {
  initContextMenu();
  initSidebarResize();

  // Add context menu handler for empty space (only once during init)
  fileTree.addEventListener("contextmenu", handleFileTreeContextMenu);
}
