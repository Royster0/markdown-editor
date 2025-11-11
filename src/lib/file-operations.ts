/**
 * File operations (open, save, new file)
 */

import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { state } from "./core/state";
import { updateStatistics } from "./ui/ui";
import { refreshFileTree } from "./file-tree/file-tree";
import { hideWelcomeScreen } from "./ui/welcome-screen";
import { openInTab, markCurrentTabClean } from "./tabs/tabs";

/**
 * Save the current file
 */
export async function saveFile(): Promise<void> {
  try {
    if (state.currentFile) {
      await writeTextFile(state.currentFile, state.content);
      markCurrentTabClean();
    } else {
      await saveFileAs();
    }
  } catch (error) {
    console.error("Error saving file:", error);
    alert("Failed to save file");
  }
}

/**
 * Save file with a new name/location
 */
export async function saveFileAs(): Promise<void> {
  try {
    const filePath = await save({
      filters: [
        {
          name: "Markdown",
          extensions: ["md"],
        },
      ],
      defaultPath: "Untitled.md",
    });

    if (filePath) {
      const isNewFile = state.currentFile !== filePath;
      await writeTextFile(filePath, state.content);
      state.currentFile = filePath;
      markCurrentTabClean();

      // Refresh file tree if we saved a new file in the current folder
      if (isNewFile && state.currentFolder) {
        await refreshFileTree();
      }
    }
  } catch (error) {
    console.error("Error saving file:", error);
    alert("Failed to save file");
  }
}

/**
 * Create a new file
 */
export async function newFile(): Promise<void> {
  // Open a new empty tab
  await openInTab(null, "");

  // Update UI
  updateStatistics("");
  hideWelcomeScreen();
}

/**
 * Open a file dialog and load the selected file
 */
export async function openFile(): Promise<void> {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Markdown",
          extensions: ["md", "markdown", "txt"],
        },
      ],
    });

    if (selected && typeof selected === "string") {
      await loadFileContent(selected);
    }
  } catch (error) {
    console.error("Error opening file:", error);
    alert("Failed to open file");
  }
}

/**
 * Load file content into the editor
 * @param filePath - Path to the file to load
 */
export async function loadFileContent(filePath: string): Promise<void> {
  try {
    console.log("loadFileContent called with path:", filePath);
    console.log("Attempting to read file...");

    // Try reading via Tauri command first (more reliable for files we just created)
    let content: string;
    try {
      content = await invoke<string>("read_file_from_path", { path: filePath });
      console.log("File read via Tauri command, content length:", content.length);
    } catch (err) {
      console.log("Tauri command failed, trying fs plugin:", err);
      content = await readTextFile(filePath);
      console.log("File read via fs plugin, content length:", content.length);
    }

    // Open file in a tab (will create new tab or switch to existing)
    await openInTab(filePath, content);

    // Update UI
    updateStatistics(content);

    // Hide welcome screen since file is now loaded
    hideWelcomeScreen();

    console.log("File loaded successfully:", filePath);
  } catch (error) {
    console.error("Error loading file:", filePath);
    console.error("Error details:", error);
    console.error("Error type:", typeof error);
    console.error("Error stringified:", JSON.stringify(error, null, 2));
    alert(`Failed to load file: ${error}`);
  }
}
