/**
 * File tree UI module
 * Handles file tree rendering and UI interactions
 */

import { invoke } from "@tauri-apps/api/core";
import type { FileEntry } from "../core/types";
import { fileTree } from "../core/dom";
import { loadFileContent } from "../file-operations";
import { showContextMenu, initContextMenu } from "./context-menu";
import { expandedFolders, refreshAndRevealFile, refreshFileTree } from "./file-tree-core";
import { initSidebarResize } from "./sidebar";
import { state } from "../core/state";

// Store the currently dragged item
let draggedItemPath: string | null = null;
let isDragging = false;

// Track selected items for multi-select
const selectedItems = new Set<string>();
let lastSelectedPath: string | null = null;

// Clipboard for copy/paste operations
interface ClipboardData {
  paths: string[];
  operation: 'copy' | 'cut';
}
let clipboard: ClipboardData | null = null;

/**
 * Context menu handler for empty space in file tree
 */
function handleFileTreeContextMenu(e: MouseEvent) {
  // Only trigger if clicking directly on fileTree (not on tree items)
  if (e.target === fileTree) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, null, false, selectedItems.size);
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

    // If right-clicking on a non-selected item, select it first
    if (!selectedItems.has(entry.path)) {
      clearAllSelections();
      selectItem(entry.path, item);
    }

    showContextMenu(e.clientX, e.clientY, entry.path, entry.is_dir, selectedItems.size);
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

      // Handle multi-select for folders
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Click: Toggle selection
        toggleItemSelection(entry.path, item);
      } else if (e.shiftKey && lastSelectedPath) {
        // Shift+Click: Range selection
        selectRange(lastSelectedPath, entry.path);
      } else {
        // Normal click: Single selection and toggle folder
        clearAllSelections();
        selectItem(entry.path, item);
        await toggleFolder(item, childrenContainer, entry, level);
      }
    });
  } else {
    // Click handler for files
    item.addEventListener("click", async (e) => {
      if (isDragging) return; // Don't handle clicks while dragging
      e.stopPropagation();

      // Handle multi-select
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Click: Toggle selection
        toggleItemSelection(entry.path, item);
      } else if (e.shiftKey && lastSelectedPath) {
        // Shift+Click: Range selection
        selectRange(lastSelectedPath, entry.path);
      } else {
        // Normal click: Single selection
        clearAllSelections();
        selectItem(entry.path, item);
        await loadFileContent(entry.path);
      }
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
  // Track mousedown to distinguish between click and drag
  item.addEventListener("mousedown", () => {
    isDragging = false;
  });

  // Drag start handler
  item.addEventListener("dragstart", (e: DragEvent) => {
    isDragging = true;
    draggedItemPath = entry.path;
    item.classList.add("dragging");

    // Set drag data - MUST set at least one data item for drag to work
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", entry.path);

      // Set a custom drag image
      const dragImage = item.cloneNode(true) as HTMLElement;
      dragImage.style.position = "absolute";
      dragImage.style.top = "-9999px";
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);

      // Clean up the drag image after a short delay
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
    }
  });

  // Drag end handler
  item.addEventListener("dragend", () => {
    item.classList.remove("dragging");
    draggedItemPath = null;

    // Reset isDragging after a short delay to allow click events to check it
    setTimeout(() => {
      isDragging = false;
    }, 10);

    // Remove all drag-over classes
    document.querySelectorAll(".tree-item.drag-over")
      .forEach(el => el.classList.remove("drag-over"));
    fileTree.classList.remove("drag-over-root");
  });

  // Drag over handler - applies to all items but only folders are valid drop targets
  item.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
 * Delete multiple selected items
 */
async function deleteSelectedItems() {
  if (selectedItems.size === 0) return;

  const itemCount = selectedItems.size;
  const confirmed = await window.confirm(
    `Delete ${itemCount} item${itemCount > 1 ? 's' : ''}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    for (const path of Array.from(selectedItems)) {
      const item = fileTree.querySelector(`.tree-item[data-path="${CSS.escape(path)}"]`);
      const isDir = item?.getAttribute("data-is-dir") === "true";

      if (isDir) {
        await invoke("delete_folder", { path });
      } else {
        await invoke("delete_file", { path });
      }
    }

    // Clear selections
    clearAllSelections();

    // Refresh the file tree
    await refreshFileTree();
    console.log("Successfully deleted selected items");
  } catch (error) {
    console.error("Failed to delete items:", error);
    alert(`Failed to delete items: ${error}`);
  }
}

/**
 * Select a single item
 */
function selectItem(path: string, element: HTMLElement) {
  selectedItems.clear();
  selectedItems.add(path);
  lastSelectedPath = path;
  element.classList.add("selected");
}

/**
 * Toggle item selection
 */
function toggleItemSelection(path: string, element: HTMLElement) {
  if (selectedItems.has(path)) {
    selectedItems.delete(path);
    element.classList.remove("selected");
    if (lastSelectedPath === path) {
      lastSelectedPath = selectedItems.size > 0 ? Array.from(selectedItems)[0] : null;
    }
  } else {
    selectedItems.add(path);
    lastSelectedPath = path;
    element.classList.add("selected");
  }
}

/**
 * Clear all selections
 */
function clearAllSelections() {
  selectedItems.clear();
  document.querySelectorAll(".tree-item.selected")
    .forEach((el) => el.classList.remove("selected"));
}

/**
 * Select a range of items between two paths
 */
function selectRange(startPath: string, endPath: string) {
  const allItems = Array.from(fileTree.querySelectorAll(".tree-item")) as HTMLElement[];
  const startIndex = allItems.findIndex(item => item.getAttribute("data-path") === startPath);
  const endIndex = allItems.findIndex(item => item.getAttribute("data-path") === endPath);

  if (startIndex === -1 || endIndex === -1) return;

  const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

  clearAllSelections();
  for (let i = from; i <= to; i++) {
    const item = allItems[i];
    const path = item.getAttribute("data-path");
    if (path) {
      selectedItems.add(path);
      item.classList.add("selected");
    }
  }
  lastSelectedPath = endPath;
}

/**
 * Copy selected items to clipboard
 */
function copySelectedItems() {
  if (selectedItems.size === 0) return;
  clipboard = {
    paths: Array.from(selectedItems),
    operation: 'copy'
  };
  console.log("Copied items:", clipboard.paths);

  // Remove cut visual feedback from all items
  document.querySelectorAll(".tree-item.cut")
    .forEach(el => el.classList.remove("cut"));
}

/**
 * Cut selected items to clipboard
 */
function cutSelectedItems() {
  if (selectedItems.size === 0) return;
  clipboard = {
    paths: Array.from(selectedItems),
    operation: 'cut'
  };
  console.log("Cut items:", clipboard.paths);

  // Add visual feedback for cut items
  document.querySelectorAll(".tree-item.cut")
    .forEach(el => el.classList.remove("cut"));

  selectedItems.forEach(path => {
    const item = fileTree.querySelector(`.tree-item[data-path="${CSS.escape(path)}"]`);
    if (item) {
      item.classList.add("cut");
    }
  });
}

/**
 * Paste items from clipboard
 */
async function pasteItems(targetPath: string | null) {
  if (!clipboard || clipboard.paths.length === 0) {
    console.log("Nothing to paste");
    return;
  }

  // Determine the destination folder
  let destPath = targetPath;
  if (!destPath) {
    destPath = state.currentFolder;
  } else if (targetPath) {
    // Check if target is a file or folder
    const targetItem = fileTree.querySelector(`.tree-item[data-path="${CSS.escape(targetPath)}"]`);
    const isDir = targetItem?.getAttribute("data-is-dir") === "true";
    if (!isDir) {
      // If it's a file, use its parent directory
      const separator = targetPath.includes("\\") ? "\\" : "/";
      const parts = targetPath.split(separator);
      parts.pop();
      destPath = parts.join(separator) || state.currentFolder;
    }
  }

  if (!destPath) {
    alert("No destination folder");
    return;
  }

  console.log("Pasting to:", destPath);
  console.log("Items:", clipboard.paths);
  console.log("Operation:", clipboard.operation);

  try {
    for (const sourcePath of clipboard.paths) {
      const separator = sourcePath.includes("\\") ? "\\" : "/";
      const fileName = sourcePath.split(separator).pop();

      if (!fileName) continue;

      if (clipboard.operation === 'cut') {
        // Move the item
        console.log("Moving:", sourcePath, "to:", destPath);
        const newPath = await invoke<string>("move_path", {
          sourcePath: sourcePath,
          destDirPath: destPath,
        });

        // Update state if we moved the currently open file
        if (state.currentFile === sourcePath) {
          state.currentFile = newPath;
        }
      } else {
        // Copy the item
        console.log("Copying:", sourcePath, "to:", destPath);
        await invoke("copy_path", {
          sourcePath: sourcePath,
          destDirPath: destPath,
        });
      }
    }

    // Clear clipboard and visual feedback after cut operation
    if (clipboard.operation === 'cut') {
      document.querySelectorAll(".tree-item.cut")
        .forEach(el => el.classList.remove("cut"));
      clipboard = null;
    }

    // Refresh the file tree
    await refreshFileTree();
    console.log("Paste operation completed successfully");
  } catch (error) {
    console.error("Failed to paste:", error);
    alert(`Failed to paste: ${error}`);
  }
}

/**
 * Initialize file tree functionality
 */
export function initFileTree() {
  initContextMenu();
  initSidebarResize();

  // Add event listeners for context menu actions
  document.addEventListener('file-tree-copy', () => {
    copySelectedItems();
  });

  document.addEventListener('file-tree-cut', () => {
    cutSelectedItems();
  });

  document.addEventListener('file-tree-paste', async (e: Event) => {
    const customEvent = e as CustomEvent;
    const targetPath = customEvent.detail?.targetPath || null;
    await pasteItems(targetPath);
  });

  document.addEventListener('file-tree-delete', async () => {
    await deleteSelectedItems();
  });

  // Add keyboard shortcuts for copy/paste
  document.addEventListener("keydown", async (e) => {
    // Only handle shortcuts when file tree is focused or selected items exist
    const isFileTreeFocused = fileTree.contains(document.activeElement) ||
                              selectedItems.size > 0;

    if (!isFileTreeFocused) return;

    // Copy: Ctrl+C or Cmd+C
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      copySelectedItems();
    }
    // Cut: Ctrl+X or Cmd+X
    else if ((e.ctrlKey || e.metaKey) && e.key === 'x' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      cutSelectedItems();
    }
    // Paste: Ctrl+V or Cmd+V
    else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      // Paste to the first selected item or current folder
      const targetPath = selectedItems.size > 0 ?
                         Array.from(selectedItems)[0] :
                         state.currentFolder;
      await pasteItems(targetPath);
    }
    // Select All: Ctrl+A or Cmd+A (when focused in file tree)
    else if ((e.ctrlKey || e.metaKey) && e.key === 'a' &&
             fileTree.contains(document.activeElement)) {
      e.preventDefault();
      // Select all visible items
      const allItems = fileTree.querySelectorAll(".tree-item") as NodeListOf<HTMLElement>;
      clearAllSelections();
      allItems.forEach(item => {
        const path = item.getAttribute("data-path");
        if (path) {
          selectedItems.add(path);
          item.classList.add("selected");
        }
      });
      if (selectedItems.size > 0) {
        lastSelectedPath = Array.from(selectedItems)[selectedItems.size - 1];
      }
    }
  });

  // Add context menu handler for empty space (only once during init)
  fileTree.addEventListener("contextmenu", handleFileTreeContextMenu);

  // Allow dropping into empty space to move items to root folder
  fileTree.addEventListener("dragover", (e: DragEvent) => {
    // Only handle if dragging over the fileTree itself (empty space), not child elements
    if (e.target === fileTree) {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      fileTree.classList.add("drag-over-root");
    }
  });

  fileTree.addEventListener("dragleave", (e: DragEvent) => {
    // Only process if leaving the fileTree itself
    if (e.target === fileTree) {
      fileTree.classList.remove("drag-over-root");
    }
  });

  fileTree.addEventListener("drop", async (e: DragEvent) => {
    // Only handle if dropping on the fileTree itself (empty space)
    if (e.target === fileTree) {
      e.preventDefault();
      fileTree.classList.remove("drag-over-root");

      if (!draggedItemPath || !state.currentFolder) return;

      try {
        // Move the file/folder to the root directory
        const newPath = await invoke<string>("move_path", {
          sourcePath: draggedItemPath,
          destDirPath: state.currentFolder,
        });

        // Update state if we moved the currently open file
        if (state.currentFile === draggedItemPath) {
          state.currentFile = newPath;
        }

        // Refresh and reveal the moved item
        await refreshAndRevealFile(newPath);
      } catch (error) {
        console.error("Failed to move to root:", error);
        alert(`Failed to move: ${error}`);
      }
    }
  });
}
