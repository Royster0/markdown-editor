/**
 * Tab management for the editor
 */

import { state, markDirty, updateTitle } from "./state";
import { editor } from "./dom";
import { setEditorContent } from "./rendering";
import { saveFile } from "./file-operations";
import { createNewWindow } from "./window-controls";

export interface Tab {
  id: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
  cursorLine: number | null;
}

// Tab state
let tabs: Tab[] = [];
let activeTabIndex: number = -1;

/**
 * Generate a unique ID for a tab
 */
function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the display name for a tab
 */
export function getTabDisplayName(tab: Tab): string {
  if (tab.filePath) {
    return tab.filePath.split(/[\\/]/).pop() || "Untitled.md";
  }
  return "Untitled.md";
}

/**
 * Save the current editor state to the active tab
 */
function saveCurrentTabState(): void {
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    const currentTab = tabs[activeTabIndex];
    currentTab.content = state.content;
    currentTab.isDirty = state.isDirty;
    currentTab.cursorLine = state.currentLine;
    currentTab.filePath = state.currentFile;
  }
}

/**
 * Load a tab's state into the editor
 */
async function loadTabState(tab: Tab): Promise<void> {
  state.content = tab.content;
  state.isDirty = tab.isDirty;
  state.currentLine = tab.cursorLine;
  state.currentFile = tab.filePath;

  editor.blur();
  editor.innerHTML = "";
  await setEditorContent(tab.content);
  updateTitle();
  updateTabBar();
}

/**
 * Create a new tab
 */
export function createTab(filePath: string | null = null, content: string = ""): Tab {
  const tab: Tab = {
    id: generateTabId(),
    filePath,
    content,
    isDirty: false,
    cursorLine: null,
  };
  return tab;
}

/**
 * Open a file in a new tab or switch to existing tab
 */
export async function openInTab(filePath: string | null, content: string): Promise<void> {
  // Check if file is already open in a tab (only for files with a path)
  if (filePath !== null) {
    const existingTabIndex = tabs.findIndex(tab => tab.filePath === filePath);
    if (existingTabIndex !== -1) {
      // Switch to existing tab
      await switchToTab(existingTabIndex);
      return;
    }
  }

  // Save current tab state before creating new tab
  if (activeTabIndex >= 0) {
    saveCurrentTabState();
  }

  // Create new tab
  const newTab = createTab(filePath, content);
  tabs.push(newTab);
  activeTabIndex = tabs.length - 1;

  // Load the new tab
  await loadTabState(newTab);
}

/**
 * Switch to a specific tab by index
 */
export async function switchToTab(index: number): Promise<void> {
  if (index < 0 || index >= tabs.length) {
    return;
  }

  // Save current tab state
  if (activeTabIndex >= 0) {
    saveCurrentTabState();
  }

  // Switch to new tab
  activeTabIndex = index;
  await loadTabState(tabs[index]);
}

/**
 * Close a tab by index
 */
export async function closeTab(index: number): Promise<void> {
  if (index < 0 || index >= tabs.length) {
    return;
  }

  const tab = tabs[index];

  // Check for unsaved changes
  if (tab.isDirty) {
    const shouldSave = confirm(
      `Do you want to save changes to ${getTabDisplayName(tab)}?`
    );
    if (shouldSave && tab.filePath) {
      // Temporarily switch to this tab to save it
      const wasActiveIndex = activeTabIndex;
      activeTabIndex = index;
      await loadTabState(tab);
      await saveFile();
      activeTabIndex = wasActiveIndex;
    }
  }

  // Remove the tab
  tabs.splice(index, 1);

  // Update active tab index
  if (tabs.length === 0) {
    // No tabs left, create a new empty tab
    const emptyTab = createTab(null, "");
    tabs.push(emptyTab);
    activeTabIndex = 0;
    await loadTabState(emptyTab);
  } else if (index <= activeTabIndex) {
    // Adjust active tab index
    activeTabIndex = Math.max(0, activeTabIndex - 1);
    await loadTabState(tabs[activeTabIndex]);
  } else if (activeTabIndex >= tabs.length) {
    // Active tab was the last one, switch to new last tab
    activeTabIndex = tabs.length - 1;
    await loadTabState(tabs[activeTabIndex]);
  } else {
    // Just update the tab bar, no need to switch
    updateTabBar();
  }
}

/**
 * Close the currently active tab
 */
export async function closeActiveTab(): Promise<void> {
  if (activeTabIndex >= 0) {
    await closeTab(activeTabIndex);
  }
}

/**
 * Get all tabs
 */
export function getTabs(): Tab[] {
  return tabs;
}

/**
 * Get the active tab index
 */
export function getActiveTabIndex(): number {
  return activeTabIndex;
}

/**
 * Get the active tab
 */
export function getActiveTab(): Tab | null {
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    return tabs[activeTabIndex];
  }
  return null;
}

/**
 * Update the tab bar UI
 */
export function updateTabBar(): void {
  const tabBar = document.getElementById("tab-bar");
  if (!tabBar) return;

  // Clear existing tabs
  tabBar.innerHTML = "";

  // Create tab elements
  tabs.forEach((tab, index) => {
    const tabElement = document.createElement("div");
    tabElement.className = "tab" + (index === activeTabIndex ? " active" : "");
    tabElement.dataset.tabIndex = String(index);
    tabElement.draggable = true;

    // Tab label
    const tabLabel = document.createElement("span");
    tabLabel.className = "tab-label";
    const displayName = getTabDisplayName(tab);
    tabLabel.textContent = tab.isDirty ? `${displayName} •` : displayName;
    tabLabel.title = tab.filePath || displayName;

    // Close button
    const closeButton = document.createElement("button");
    closeButton.className = "tab-close";
    closeButton.innerHTML = "×";
    closeButton.title = "Close tab";

    // Click event listeners
    tabLabel.addEventListener("click", async () => {
      await switchToTab(index);
    });

    closeButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      await closeTab(index);
    });

    // Drag event listeners
    let lastValidX = 0;
    let lastValidY = 0;

    tabElement.addEventListener("dragstart", (e) => {
      lastValidX = e.clientX;
      lastValidY = e.clientY;

      // Store tab data for potential new window creation
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
      }

      tabElement.classList.add("dragging");
    });

    tabElement.addEventListener("drag", (e) => {
      // Track the last valid position during drag
      if (e.clientX !== 0 || e.clientY !== 0) {
        lastValidX = e.clientX;
        lastValidY = e.clientY;
      }
    });

    tabElement.addEventListener("dragend", async (e) => {
      tabElement.classList.remove("dragging");

      // Get the final position - if clientX/Y are 0, use last valid position
      const finalX = e.clientX !== 0 ? e.clientX : lastValidX;
      const finalY = e.clientY !== 0 ? e.clientY : lastValidY;

      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const tabBarHeight = 80; // Approximate height of titlebar + tab bar

      // Check if dropped outside the window or significantly above the tab bar
      const isOutsideWindow =
        finalX < 0 ||
        finalX > windowWidth ||
        finalY < 0 ||
        finalY > windowHeight;

      const isDraggedOut = finalY < tabBarHeight - 30; // Allow some threshold

      if (isOutsideWindow || isDraggedOut) {
        // Only create new window if there are multiple tabs
        if (tabs.length > 1) {
          // Check if the tab has a saved file path
          if (!tab.filePath) {
            alert("Please save the file before dragging it to a new window.");
            return;
          }

          // Create new window with the file path
          await createNewWindow({
            filePath: tab.filePath,
          });

          // Remove the tab from current window
          await closeTab(index);
        }
      }
    });

    tabElement.appendChild(tabLabel);
    tabElement.appendChild(closeButton);
    tabBar.appendChild(tabElement);
  });
}

/**
 * Initialize the tab system
 */
export function initTabs(): void {
  // Create initial empty tab if no tabs exist
  if (tabs.length === 0) {
    const initialTab = createTab(state.currentFile, state.content);
    initialTab.isDirty = state.isDirty;
    initialTab.cursorLine = state.currentLine;
    tabs.push(initialTab);
    activeTabIndex = 0;
  }

  updateTabBar();
}

/**
 * Mark the current tab as dirty
 */
export function markCurrentTabDirty(): void {
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    tabs[activeTabIndex].isDirty = true;
    markDirty();
    updateTabBar();
  }
}

/**
 * Mark the current tab as clean (saved)
 */
export function markCurrentTabClean(): void {
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    tabs[activeTabIndex].isDirty = false;
    state.isDirty = false;
    updateTitle();
    updateTabBar();
  }
}

/**
 * Update current tab content
 */
export function updateCurrentTabContent(content: string): void {
  if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
    tabs[activeTabIndex].content = content;
  }
}
