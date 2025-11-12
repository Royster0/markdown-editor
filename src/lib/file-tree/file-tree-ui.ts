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
let isDragging = false;

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
    arrow.setAttribute("draggable", "false"); // Prevent child from being draggable
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
    spacer.setAttribute("draggable", "false");
    item.appendChild(spacer);
  }

  // Icon
  const icon = document.createElement("span");
  icon.className = "tree-item-icon";
  icon.setAttribute("draggable", "false"); // Prevent child from being draggable
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
  name.setAttribute("draggable", "false"); // Prevent child from being draggable
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
      if (isDragging) return; // Don't handle clicks while dragging
      e.stopPropagation();
      await toggleFolder(item, childrenContainer, entry, level);
    });
  } else {
    // Click handler for files
    item.addEventListener("click", async (e) => {
      if (isDragging) return; // Don't handle clicks while dragging
      e.stopPropagation();
      await loadFileContent(entry.path);

      // Update selection
      document
        .querySelectorAll(".tree-item")
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
    });
  }

  // Debug: Test if mouseover events reach the item
  item.addEventListener("mouseover", () => {
    console.log("🖱️ Mouse over:", entry.name);
  }, { once: true }); // Only log once per item to avoid spam

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
  // Track mousedown to distinguish between click and drag
  item.addEventListener("mousedown", () => {
    isDragging = false;
    console.log("🖱️ Mouse down on:", entry.name);
  });

  // Drag start handler
  item.addEventListener("dragstart", (e: DragEvent) => {
    console.log("🚀 Drag started:", entry.name, "is_dir:", entry.is_dir);

    // CRITICAL: Don't call preventDefault on dragstart - it cancels the drag!
    // e.preventDefault();

    isDragging = true;
    draggedItemPath = entry.path;
    item.classList.add("dragging");

    // Set drag data - MUST set at least one data item for drag to work
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", entry.path);

      // Set a custom drag image to ensure browser handles drag properly
      // This might help Tauri webview recognize the drag operation
      const dragImage = item.cloneNode(true) as HTMLElement;
      dragImage.style.position = "absolute";
      dragImage.style.top = "-9999px";
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);

      // Clean up the drag image after a short delay
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);

      // Debug: Check if dataTransfer is properly set
      console.log("  ✓ Drag data set, effectAllowed:", e.dataTransfer.effectAllowed);
      console.log("  ✓ DataTransfer types:", e.dataTransfer.types);
      console.log("  ✓ DataTransfer items length:", e.dataTransfer.items.length);
    } else {
      console.log("  ✗ ERROR: dataTransfer is null!");
    }
  });

  // Drag end handler
  item.addEventListener("dragend", () => {
    console.log("🏁 Drag ended");
    item.classList.remove("dragging");
    draggedItemPath = null;

    // Reset isDragging after a short delay to allow click events to check it
    setTimeout(() => {
      isDragging = false;
    }, 10);

    // Remove all drag-over classes
    document.querySelectorAll(".tree-item.drag-over")
      .forEach(el => el.classList.remove("drag-over"));
  });

  // Drag over handler - applies to all items but only folders are valid drop targets
  // Use capture phase to intercept events before they reach children
  item.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    // Don't stopPropagation - let events bubble to document for debugging
    // e.stopPropagation();

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
  }, true); // Add capture:true to intercept in capture phase

  // Drag enter handler - fires when drag first enters the element
  item.addEventListener("dragenter", (e: DragEvent) => {
    e.preventDefault();
    // Don't stopPropagation - let events bubble to document for debugging
    // e.stopPropagation();
    console.log("🎯 Drag enter:", entry.name, "is_dir:", entry.is_dir);
  }, true); // Add capture:true

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

  // Global dragover handler to catch all drag events
  fileTree.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    console.log("🌍 Global dragover on fileTree, target:", (e.target as HTMLElement)?.className);
  });

  // Global dragenter handler
  fileTree.addEventListener("dragenter", (e: DragEvent) => {
    e.preventDefault();
    console.log("🌍 Global dragenter on fileTree, target:", (e.target as HTMLElement)?.className);
  });

  // EXTREME DEBUG: Add to document to see if drag events fire ANYWHERE
  document.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    console.log("🌐 DOCUMENT dragover, target:", (e.target as HTMLElement)?.className || (e.target as HTMLElement)?.tagName);
  });

  document.addEventListener("dragenter", (e: DragEvent) => {
    e.preventDefault();
    console.log("🌐 DOCUMENT dragenter, target:", (e.target as HTMLElement)?.className || (e.target as HTMLElement)?.tagName);
  });
}
