/**
 * File tree UI module
 * Handles file tree rendering and UI interactions
 */

import { invoke } from "@tauri-apps/api/core";
import type { FileEntry } from "../core/types";
import { fileTree } from "../core/dom";
import { loadFileContent } from "../file-operations";
import { showContextMenu, initContextMenu } from "./context-menu";
import { expandedFolders, refreshAndRevealFile } from "./file-tree-core";
import { initSidebarResize } from "./sidebar";
import { state } from "../core/state";

// Store the currently dragged item
let draggedItemPath: string | null = null;

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
export function renderFileTree(entries: FileEntry[]) {
  // Clear file tree but keep the header
  const header = fileTree.querySelector(".file-tree-header");
  fileTree.innerHTML = "";

  // Re-add the header if it existed
  if (header) {
    fileTree.appendChild(header);
  }

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
export function createTreeItem(entry: FileEntry, level: number = 0): HTMLElement {
  const container = document.createElement("div");

  const item = document.createElement("div");
  item.className = "tree-item";
  item.style.paddingLeft = `${level * 16 + 8}px`;
  item.setAttribute("data-path", entry.path);
  item.setAttribute("data-is-dir", entry.is_dir.toString());

  // Make item draggable
  item.setAttribute("draggable", "true");

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

  // Drag and drop handlers
  setupDragAndDrop(item, entry);

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
 * Setup drag and drop handlers for a tree item
 * @param item - The tree item element
 * @param entry - File entry for the item
 */
function setupDragAndDrop(item: HTMLElement, entry: FileEntry) {
  // Drag start handler
  item.addEventListener("dragstart", (e: DragEvent) => {
    console.log("🚀 Drag started:", entry.name, "is_dir:", entry.is_dir);
    draggedItemPath = entry.path;
    item.classList.add("dragging");

    // Set drag data
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", entry.path);
    }
  });

  // Drag end handler
  item.addEventListener("dragend", () => {
    console.log("🏁 Drag ended");
    item.classList.remove("dragging");
    draggedItemPath = null;

    // Remove all drag-over classes
    document.querySelectorAll(".tree-item.drag-over")
      .forEach(el => el.classList.remove("drag-over"));
  });

  // Drag over handler - applies to all items but only folders are valid drop targets
  item.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("👆 Drag over:", entry.name, "is_dir:", entry.is_dir, "dragged:", draggedItemPath?.split(/[\\/]/).pop());

    // Only folders can be drop targets
    if (!entry.is_dir) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "none";
      }
      return;
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }

    // Don't allow dropping into itself or if no item is being dragged
    if (!draggedItemPath || draggedItemPath === entry.path) {
      return;
    }

    // Check if we're not trying to move a parent folder into its child
    const separator = entry.path.includes("\\") ? "\\" : "/";
    if (entry.path.startsWith(draggedItemPath + separator)) {
      return;
    }

    item.classList.add("drag-over");
  });

  // Drag leave handler - applies to all items
  item.addEventListener("dragleave", (e: DragEvent) => {
    // Only process if this is a folder
    if (!entry.is_dir) {
      return;
    }

    // Only remove drag-over if we're actually leaving the item, not just entering a child
    const rect = item.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      item.classList.remove("drag-over");
    }
  });

  // Drop handler - only folders handle drops
  if (entry.is_dir) {
    item.addEventListener("drop", async (e: DragEvent) => {
      console.log("📦 Drop on:", entry.name);
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove("drag-over");

      if (!draggedItemPath) return;

      // Don't allow dropping into itself
      if (draggedItemPath === entry.path) {
        return;
      }

      // Don't allow moving a parent folder into its child
      const separator = entry.path.includes("\\") ? "\\" : "/";
      if (entry.path.startsWith(draggedItemPath + separator)) {
        alert("Cannot move a folder into its own subfolder");
        return;
      }

      try {
        console.log("Moving:", draggedItemPath, "to:", entry.path);
        // Move the file/folder
        const newPath = await invoke<string>("move_path", {
          sourcePath: draggedItemPath,
          destDirPath: entry.path,
        });

        console.log("Moved successfully to:", newPath);

        // Update state if we moved the currently open file
        if (state.currentFile === draggedItemPath) {
          state.currentFile = newPath;
        }

        // Refresh and reveal the moved item
        await refreshAndRevealFile(newPath);
      } catch (error) {
        console.error("Failed to move:", error);
        alert(`Failed to move: ${error}`);
      }
    });
  }
}

/**
 * Initialize file tree functionality
 */
export function initFileTree() {
  initContextMenu();
  initSidebarResize();

  // Add context menu handler for empty space (only once during init)
  fileTree.addEventListener("contextmenu", handleFileTreeContextMenu);

  // Add dragover handler to file tree to prevent default when dragging over empty space
  fileTree.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "none";
    }
  });
}
