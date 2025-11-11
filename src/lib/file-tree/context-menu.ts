/**
 * Context menu functionality for file tree
 */

import { invoke } from "@tauri-apps/api/core";
import { state } from "../core/state";
import { refreshAndRevealFile, refreshFileTree } from "./file-tree";
import { loadFileContent, newFile } from "../file-operations";

interface ContextMenuItem {
  label: string;
  icon: string;
  action: () => void | Promise<void>;
}

let contextMenu: HTMLDivElement | null = null;

/**
 * Initialize context menu
 */
export function initContextMenu() {
  // Create context menu element
  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  document.body.appendChild(contextMenu);

  // Close context menu when clicking outside
  document.addEventListener("click", () => {
    hideContextMenu();
  });

  // Close context menu on escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideContextMenu();
    }
  });
}

/**
 * Show context menu at specific coordinates
 */
export function showContextMenu(
  x: number,
  y: number,
  path: string | null,
  isDir: boolean
) {
  if (!contextMenu) return;

  // Build menu items based on context
  const items = getContextMenuItems(path, isDir);

  // Clear existing items
  contextMenu.innerHTML = "";

  // Add menu items
  items.forEach((item) => {
    if (item === "separator") {
      const separator = document.createElement("div");
      separator.className = "context-menu-separator";
      contextMenu!.appendChild(separator);
    } else {
      const menuItem = document.createElement("div");
      menuItem.className = "context-menu-item";
      menuItem.innerHTML = `${item.icon}<span>${item.label}</span>`;
      menuItem.addEventListener("click", async (e) => {
        e.stopPropagation();
        await item.action();
        hideContextMenu();
      });
      contextMenu!.appendChild(menuItem);
    }
  });

  // Position the menu
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  // Adjust position if menu would go off-screen
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`;
  }

  // Show the menu
  contextMenu.classList.add("visible");
}

/**
 * Hide context menu
 */
export function hideContextMenu() {
  if (contextMenu) {
    contextMenu.classList.remove("visible");
  }
}

/**
 * Get context menu items based on what was right-clicked
 */
function getContextMenuItems(
  path: string | null,
  isDir: boolean
): (ContextMenuItem | "separator")[] {
  const fileIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 1h7l3 3v10H3z"></path><polyline points="10 1 10 4 13 4"></polyline></svg>`;
  const folderIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h4l1 2h7v9H2z"></path></svg>`;
  const renameIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h10M8 3v9"></path></svg>`;
  const deleteIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M5 4V3h6v1M6 4v8h4V4"></path></svg>`;

  if (!path) {
    // Right-clicked on empty space
    return [
      {
        label: "New Markdown File",
        icon: fileIcon,
        action: () => createNewFile(state.currentFolder, true),
      },
      {
        label: "New Folder",
        icon: folderIcon,
        action: () => createNewFolder(state.currentFolder),
      },
    ];
  } else if (isDir) {
    // Right-clicked on a folder
    return [
      {
        label: "New Markdown File",
        icon: fileIcon,
        action: () => createNewFile(path, true),
      },
      {
        label: "New Folder",
        icon: folderIcon,
        action: () => createNewFolder(path),
      },
      "separator",
      {
        label: "Rename",
        icon: renameIcon,
        action: () => renameItem(path, true),
      },
      {
        label: "Delete",
        icon: deleteIcon,
        action: () => deleteItem(path, true),
      },
    ];
  } else {
    // Right-clicked on a file
    return [
      {
        label: "Open File",
        icon: fileIcon,
        action: () => loadFileContent(path),
      },
      "separator",
      {
        label: "Rename",
        icon: renameIcon,
        action: () => renameItem(path, false),
      },
      {
        label: "Delete",
        icon: deleteIcon,
        action: () => deleteItem(path, false),
      },
    ];
  }
}

/**
 * Create a new file in a given directory
 */
async function createNewFile(parentPath: string | null, isMd: boolean = true) {
  if (!parentPath) {
    alert("No folder is currently open");
    return;
  }

  const fileName = prompt(
    isMd ? "Enter file name (without .md extension):" : "Enter file name:"
  );
  if (!fileName || fileName.trim() === "") return;

  // Sanitize filename - remove invalid characters
  const sanitizedName = fileName.trim().replace(/[<>:"/\\|?*]/g, "");
  if (sanitizedName === "") {
    alert("Invalid file name");
    return;
  }

  // Add .md extension if it's a markdown file
  const fullFileName = isMd && !sanitizedName.endsWith(".md")
    ? `${sanitizedName}.md`
    : sanitizedName;

  const separator = parentPath.includes("\\") ? "\\" : "/";
  const filePath = `${parentPath}${separator}${fullFileName}`;

  try {
    console.log("Creating file:", filePath);
    await invoke("create_file", { path: filePath });
    console.log("File created successfully:", filePath);

    // Small delay to ensure file is fully written to disk
    await new Promise(resolve => setTimeout(resolve, 100));

    // Refresh the file tree and try to reveal the new file
    console.log("Refreshing file tree and revealing file...");
    await refreshAndRevealFile(filePath);

    // Another small delay before loading
    await new Promise(resolve => setTimeout(resolve, 100));

    // Open the new file in the editor
    console.log("Loading file content into editor...");
    await loadFileContent(filePath);
    console.log("File loaded successfully in editor");
  } catch (error) {
    console.error("Failed to create/load file:", error);
    console.error("File path was:", filePath);
    alert(`Failed to create/load file: ${error}\n\nPath: ${filePath}`);
  }
}

/**
 * Create a new folder in a given directory
 */
async function createNewFolder(parentPath: string | null) {
  if (!parentPath) {
    alert("No folder is currently open");
    return;
  }

  const folderName = prompt("Enter folder name:");
  if (!folderName || folderName.trim() === "") return;

  // Sanitize folder name - remove invalid characters
  const sanitizedName = folderName.trim().replace(/[<>:"/\\|?*]/g, "");
  if (sanitizedName === "") {
    alert("Invalid folder name");
    return;
  }

  const separator = parentPath.includes("\\") ? "\\" : "/";
  const folderPath = `${parentPath}${separator}${sanitizedName}`;

  try {
    await invoke("create_folder", { path: folderPath });
    console.log("Folder created successfully:", folderPath);

    // Refresh the file tree to show the new folder
    await refreshAndRevealFile(folderPath);
  } catch (error) {
    console.error("Failed to create folder:", error);
    alert(`Failed to create folder: ${error}`);
  }
}

/**
 * Rename a file or folder
 */
async function renameItem(itemPath: string, isDir: boolean) {
  // Get current name
  const separator = itemPath.includes("\\") ? "\\" : "/";
  const currentName = itemPath.split(separator).pop() || "";

  // Prompt for new name
  const newName = prompt(
    isDir ? "Enter new folder name:" : "Enter new file name:",
    currentName
  );

  if (!newName || newName.trim() === "") return;
  if (newName === currentName) return; // No change

  // Sanitize new name
  const sanitizedName = newName.trim().replace(/[<>:"/\\|?*]/g, "");
  if (sanitizedName === "") {
    alert("Invalid name");
    return;
  }

  try {
    console.log("Renaming:", itemPath, "to:", sanitizedName);
    const newPath = await invoke<string>("rename_path", {
      oldPath: itemPath,
      newName: sanitizedName
    });
    console.log("Renamed successfully to:", newPath);

    // If renaming the currently open file, update the state
    if (!isDir && state.currentFile === itemPath) {
      state.currentFile = newPath;
      console.log("Updated current file path to:", newPath);
    }

    // Refresh and reveal the renamed item
    await refreshAndRevealFile(newPath);
  } catch (error) {
    console.error("Failed to rename:", error);
    alert(`Failed to rename: ${error}`);
  }
}

/**
 * Delete a file or folder
 */
async function deleteItem(itemPath: string, isDir: boolean) {
  console.log("=== DELETE ITEM CALLED ===");
  console.log("Path:", itemPath);
  console.log("Is directory:", isDir);
  console.log("Call stack timestamp:", Date.now());

  const separator = itemPath.includes("\\") ? "\\" : "/";
  const itemName = itemPath.split(separator).pop() || "";

  if (isDir) {
    // Check folder contents
    let fileCount = 0;
    let folderCount = 0;

    try {
      console.log("[STEP 1] Checking folder contents for:", itemPath);
      const result = await invoke<[number, number]>(
        "count_folder_contents",
        { path: itemPath }
      );
      fileCount = result[0];
      folderCount = result[1];
      console.log(`[STEP 2] Folder contains ${fileCount} files and ${folderCount} folders`);
    } catch (error) {
      console.error("Failed to count folder contents:", error);
      alert(`Failed to access folder: ${error}`);
      return;
    }

    // Build confirmation message
    let confirmMessage = "";
    if (fileCount > 0 || folderCount > 0) {
      const itemsText = [];
      if (fileCount > 0) {
        itemsText.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
      }
      if (folderCount > 0) {
        itemsText.push(`${folderCount} folder${folderCount === 1 ? "" : "s"}`);
      }
      confirmMessage = `Delete folder "${itemName}"?\n\nThis folder contains ${itemsText.join(" and ")}.\nThis action cannot be undone.`;
    } else {
      confirmMessage = `Delete empty folder "${itemName}"?\n\nThis action cannot be undone.`;
    }

    // Check if confirmation is enabled
    let confirmed = true;
    if (state.confirmFolderDelete) {
      console.log("[STEP 3] Confirmation enabled, showing dialog");
      console.log("[STEP 3] Dialog message:", confirmMessage);

      // CRITICAL: Show confirmation and WAIT for user response
      // In Tauri, confirm() might return a Promise, so we need to await it
      confirmed = await window.confirm(confirmMessage);

      console.log("[STEP 4] User responded to dialog");
      console.log("[STEP 4] User confirmation result:", confirmed);
      console.log("[STEP 4] Confirmation type:", typeof confirmed);
      console.log("[STEP 4] Current timestamp:", Date.now());

      if (!confirmed) {
        console.log("[STEP 5] User CANCELLED deletion - returning now");
        return;
      }
    } else {
      console.log("[STEP 3] Folder delete confirmation disabled, proceeding without prompt");
    }

    // Only proceed if user confirmed
    console.log("[STEP 5] User CONFIRMED deletion - proceeding");
    console.log("[STEP 5] About to call delete_folder for:", itemPath);

    try {
      await invoke("delete_folder", { path: itemPath });
      console.log("[STEP 6] Folder deleted successfully:", itemPath);

      // Refresh the file tree
      await refreshFileTree();
      console.log("[STEP 7] File tree refreshed after folder deletion");
    } catch (error) {
      console.error("[ERROR] Failed to delete folder:", error);
      alert(`Failed to delete folder: ${error}`);
    }
  } else {
    // Delete file
    let confirmed = true;
    if (state.confirmFileDelete) {
      console.log("[STEP 1] Confirmation enabled, showing dialog for file:", itemName);

      // In Tauri, confirm() might return a Promise, so we need to await it
      confirmed = await window.confirm(
        `Delete file "${itemName}"?\n\nThis action cannot be undone.`
      );

      console.log("[STEP 2] User confirmation result:", confirmed);
      console.log("[STEP 2] Confirmation type:", typeof confirmed);

      if (!confirmed) {
        console.log("[STEP 3] User CANCELLED file deletion - returning now");
        return;
      }
    } else {
      console.log("[STEP 1] File delete confirmation disabled, proceeding without prompt");
    }

    try {
      console.log("[STEP 3] User CONFIRMED file deletion - proceeding");
      await invoke("delete_file", { path: itemPath });
      console.log("[STEP 4] File deleted successfully:", itemPath);

      // If deleting the currently open file, clear the editor
      if (state.currentFile === itemPath) {
        await newFile();
        console.log("[STEP 5] Cleared editor after deleting current file");
      }

      // Refresh the file tree
      await refreshFileTree();
      console.log("[STEP 6] File tree refreshed after file deletion");
    } catch (error) {
      console.error("[ERROR] Failed to delete file:", error);
      alert(`Failed to delete file: ${error}`);
    }
  }

  console.log("=== DELETE ITEM COMPLETED ===");
}
