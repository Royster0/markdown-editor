/**
 * File operations (open, save, new file)
 */

import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { state, updateTitle } from "./state";
import { editor } from "./dom";
import { setEditorContent } from "./rendering";
import { updateStatistics } from "./ui";

/**
 * Save the current file
 */
export async function saveFile(): Promise<void> {
  try {
    if (state.currentFile) {
      await writeTextFile(state.currentFile, state.content);
      state.isDirty = false;
      updateTitle();
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
      await writeTextFile(filePath, state.content);
      state.currentFile = filePath;
      state.isDirty = false;
      updateTitle();
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
  if (state.isDirty) {
    const shouldSave = confirm(
      "You have unsaved changes. Do you want to save them?"
    );
    if (shouldSave) {
      await saveFile();
    }
  }

  // Blur editor to exit edit mode
  editor.blur();
  state.editMode = false;
  state.currentLine = null;

  // Set empty content
  await setEditorContent("");
  state.content = "";
  state.currentFile = null;
  state.isDirty = false;

  // Update UI
  updateStatistics("");
  updateTitle();
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
    const content = await readTextFile(filePath);

    // Completely reset state
    state.editMode = false;
    state.currentLine = null;

    // Remove focus from editor
    editor.blur();

    // Clear editor completely
    editor.innerHTML = "";

    // Set content
    await setEditorContent(content);
    state.content = content;
    state.currentFile = filePath;
    state.isDirty = false;

    // Update UI
    updateStatistics(content);
    updateTitle();

    console.log("File loaded successfully:", filePath);
  } catch (error) {
    console.error("Error loading file:", error);
    alert("Failed to load file");
  }
}
