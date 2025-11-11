/**
 * File tree core module
 * Handles folder operations and tree navigation logic
 */

import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { FileEntry } from "../core/types";
import { fileTree, sidebar, explorerHeader } from "../core/dom";
import { state } from "../core/state";
import { reinitializeThemeForFolder } from "../settings/theme";
import { reinitializeSettingsForFolder } from "../settings/settings";
import { renderFileTree, createTreeItem } from "./file-tree-ui";
import { hideWelcomeScreen } from "../ui/welcome-screen";

// Track expanded folders to preserve state during refresh
export const expandedFolders = new Set<string>();

/**
 * Update the explorer header to show the current folder name
 */
export function updateExplorerHeader() {
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
      // Reinitialize settings for the new folder
      await reinitializeSettingsForFolder();
      // Hide welcome screen since folder is now loaded
      hideWelcomeScreen();
      // Show the sidebar when folder is opened
      state.sidebarVisible = true;
      sidebar.classList.remove("collapsed");
    }
  } catch (error) {
    console.error("Error opening folder:", error);
  }
}

/**
 * Load and render file tree for a folder path
 * @param folderPath - Path to the folder
 */
export async function loadFileTree(folderPath: string) {
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

  if (!state.currentFolder) return;

  // Try to expand parent folders and reveal the file
  await expandAndRevealPath(filePath);
}

/**
 * Expand parent folders and reveal a file/folder in the tree
 * @param targetPath - Path to the file or folder to reveal
 */
export async function expandAndRevealPath(targetPath: string) {
  // Get the parent directory of the target
  const separator = targetPath.includes("\\") ? "\\" : "/";
  const parts = targetPath.split(separator);

  // If it's at root level, just find and select it
  if (parts.length <= (state.currentFolder?.split(separator).length || 0) + 1) {
    selectTreeItem(targetPath);
    return;
  }

  // Need to expand parent folders
  // Start from the root and expand each level
  let currentPath = state.currentFolder!;
  const rootParts = currentPath.split(separator);
  const targetParts = targetPath.split(separator);

  // Find which folders need to be expanded
  for (let i = rootParts.length; i < targetParts.length - 1; i++) {
    currentPath = targetParts.slice(0, i + 1).join(separator);

    // Find the folder in the tree
    const folderItem = findTreeItemByPath(currentPath);
    if (folderItem) {
      const isDir = folderItem.getAttribute("data-is-dir") === "true";
      if (isDir) {
        // Find the children container
        const container = folderItem.parentElement;
        const childrenContainer = container?.querySelector(".tree-children");

        if (childrenContainer && childrenContainer.classList.contains("collapsed")) {
          // Expand this folder
          const arrow = folderItem.querySelector(".tree-item-arrow");
          childrenContainer.classList.remove("collapsed");
          arrow?.classList.add("expanded");
          expandedFolders.add(currentPath);

          // Load children if not already loaded
          if (childrenContainer.children.length === 0) {
            try {
              const children = await invoke<FileEntry[]>("read_directory", {
                path: currentPath,
              });

              const level = i - rootParts.length + 1;
              children.forEach((childEntry: FileEntry) => {
                const childItem = createTreeItem(childEntry, level);
                childrenContainer.appendChild(childItem);
              });
            } catch (error) {
              console.error("Error loading folder contents:", error);
              return;
            }
          }
        }
      }
    } else {
      console.error("Could not find folder in tree:", currentPath);
      return;
    }
  }

  // Now select the target item
  // Wait a bit for DOM to update
  setTimeout(() => {
    selectTreeItem(targetPath);
  }, 100);
}

/**
 * Find a tree item by its path
 */
export function findTreeItemByPath(path: string): HTMLElement | null {
  const treeItems = fileTree.querySelectorAll(".tree-item");
  for (const item of Array.from(treeItems)) {
    if (item.getAttribute("data-path") === path) {
      return item as HTMLElement;
    }
  }
  return null;
}

/**
 * Select and scroll to a tree item
 */
export function selectTreeItem(path: string) {
  // Remove previous selection
  document.querySelectorAll(".tree-item.selected")
    .forEach((el) => el.classList.remove("selected"));

  const item = findTreeItemByPath(path);
  if (item) {
    item.classList.add("selected");
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else {
    console.warn("Could not find tree item to select:", path);
  }
}
