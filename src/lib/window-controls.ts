/**
 * Window control functions (minimize, maximize, close, file menu)
 */

import { Window } from "@tauri-apps/api/window";
import { fileMenuBtn, fileMenu } from "./dom";
import { saveFile, newFile, openFile } from "./file-operations";
import { openFolder, toggleSidebar } from "./file-tree";

/**
 * Get the main application window
 */
const appWindow = Window.getCurrent();

/**
 * Initialize window controls
 */
export function initWindowControls() {
  // File menu toggle
  fileMenuBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    fileMenu?.classList.toggle("hidden");
  });

  // Close file menu when clicking outside
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!fileMenu?.contains(target) && !fileMenuBtn?.contains(target)) {
      fileMenu?.classList.add("hidden");
    }
  });

  // Window controls
  document
    .getElementById("window-minimize")
    ?.addEventListener("click", async () => {
      try {
        await appWindow.minimize();
      } catch (error) {
        console.error("Failed to minimize window:", error);
      }
    });

  document
    .getElementById("window-maximize")
    ?.addEventListener("click", async () => {
      try {
        const isMaximized = await appWindow.isMaximized();
        if (isMaximized) {
          await appWindow.unmaximize();
        } else {
          await appWindow.maximize();
        }
      } catch (error) {
        console.error("Failed to toggle maximize:", error);
      }
    });

  document
    .getElementById("window-close")
    ?.addEventListener("click", async () => {
      try {
        await appWindow.close();
      } catch (error) {
        console.error("Failed to close window:", error);
      }
    });

  // Toggle sidebar buttons
  document
    .getElementById("toggle-sidebar-titlebar")
    ?.addEventListener("click", toggleSidebar);
  document
    .getElementById("toggle-sidebar")
    ?.addEventListener("click", toggleSidebar);

  // File menu items
  document
    .getElementById("file-menu-open-folder")
    ?.addEventListener("click", async () => {
      await openFolder();
      fileMenu?.classList.add("hidden");
    });

  document
    .getElementById("file-menu-new-file")
    ?.addEventListener("click", async () => {
      await newFile();
      fileMenu?.classList.add("hidden");
    });

  document
    .getElementById("file-menu-open-file")
    ?.addEventListener("click", async () => {
      await openFile();
      fileMenu?.classList.add("hidden");
    });

  document
    .getElementById("file-menu-save-file")
    ?.addEventListener("click", async () => {
      await saveFile();
      fileMenu?.classList.add("hidden");
    });

  // Toolbar buttons (if they exist)
  document.getElementById("open-folder")?.addEventListener("click", openFolder);
  document
    .getElementById("open-folder-sidebar")
    ?.addEventListener("click", openFolder);
  document.getElementById("new-file")?.addEventListener("click", newFile);
  document.getElementById("open-file")?.addEventListener("click", openFile);
  document.getElementById("save-file")?.addEventListener("click", saveFile);
}
