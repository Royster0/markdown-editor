/**
 * Window control functions (minimize, maximize, close, file menu)
 */

import { Window } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import { fileMenuBtn, fileMenu } from "../core/dom";
import { saveFile, newFile, openFile } from "../file-operations";
import { openFolder, toggleSidebar } from "../file-tree/file-tree";
import { switchTheme, importTheme, getAvailableThemes } from "../settings/theme";
import { state } from "../core/state";

/**
 * Get the main application window
 */
const appWindow = Window.getCurrent();

/**
 * Create a new editor window
 */
let windowCounter = 0;
export async function createNewWindow(options?: { filePath?: string; content?: string }): Promise<WebviewWindow | null> {
  try {
    windowCounter++;
    const windowLabel = `editor-${Date.now()}-${windowCounter}`;

    console.log("Creating new window with label:", windowLabel);

    // Build URL with optional file path parameter
    let windowUrl = "/";
    if (options?.filePath) {
      // Encode the file path to pass it as a URL parameter
      const encodedPath = encodeURIComponent(options.filePath);
      windowUrl = `/?file=${encodedPath}`;
    }

    const newWindow = new WebviewWindow(windowLabel, {
      title: "Loom.md",
      width: 800,
      height: 600,
      decorations: false,
      url: windowUrl,
    });

    // Log when window is created
    newWindow.once("tauri://created", () => {
      console.log("New window created successfully");
    });

    // Log if there's an error
    newWindow.once("tauri://error", (error) => {
      console.error("Error creating window:", error);
    });

    return newWindow;
  } catch (error) {
    console.error("Failed to create new window:", error);
    alert(`Failed to create new window: ${error}`);
    return null;
  }
}

/**
 * Populate the theme selector dropdown
 */
export async function populateThemeSelector() {
  const themeSelector = document.getElementById("theme-selector") as HTMLSelectElement;
  if (!themeSelector) return;

  try {
    const themes = await getAvailableThemes();
    state.availableThemes = themes;

    // Clear existing options
    themeSelector.innerHTML = "";

    // Add theme options
    themes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme;
      option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
      if (theme === state.currentTheme) {
        option.selected = true;
      }
      themeSelector.appendChild(option);
    });
  } catch (error) {
    console.error("Failed to populate theme selector:", error);
    themeSelector.innerHTML = '<option value="">Error loading themes</option>';
  }
}

/**
 * Handle theme import
 */
async function handleImportTheme() {
  try {
    if (!state.currentFolder) {
      alert("Please open a folder before importing themes.\n\nThemes are stored in the .loom folder of your current project.");
      return;
    }

    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Theme",
          extensions: ["json"],
        },
      ],
    });

    if (selected && typeof selected === "string") {
      const themeName = await importTheme(selected);
      await populateThemeSelector();
      alert(`Theme "${themeName}" imported successfully!`);
    }
  } catch (error) {
    console.error("Failed to import theme:", error);
    alert("Failed to import theme. Please ensure the file is a valid theme JSON file.");
  }
}

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
    .getElementById("file-menu-new-window")
    ?.addEventListener("click", async () => {
      await createNewWindow();
      fileMenu?.classList.add("hidden");
    });

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

  // Theme controls
  const themeSelector = document.getElementById("theme-selector") as HTMLSelectElement;
  themeSelector?.addEventListener("change", async (e) => {
    const target = e.target as HTMLSelectElement;
    const themeName = target.value;
    if (themeName) {
      try {
        await switchTheme(themeName);
      } catch (error) {
        console.error("Failed to switch theme:", error);
        alert("Failed to switch theme");
      }
    }
  });

  document
    .getElementById("file-menu-import-theme")
    ?.addEventListener("click", async () => {
      await handleImportTheme();
      fileMenu?.classList.add("hidden");
    });

  // Populate theme selector on initialization
  populateThemeSelector();
}
