/**
 * Context menu functionality for file tree
 */

import { invoke } from "@tauri-apps/api/core";
import { state } from "./state";
import { refreshAndRevealFile } from "./file-tree";
import { loadFileContent } from "./file-operations";

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
    ];
  } else {
    // Right-clicked on a file
    return [
      {
        label: "Open File",
        icon: fileIcon,
        action: () => loadFileContent(path),
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
    await invoke("create_file", { path: filePath });
    console.log("File created successfully:", filePath);

    // Refresh the file tree and try to reveal the new file
    await refreshAndRevealFile(filePath);

    // Open the new file in the editor
    await loadFileContent(filePath);
  } catch (error) {
    console.error("Failed to create file:", error);
    alert(`Failed to create file: ${error}`);
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
