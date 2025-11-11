/**
 * Sidebar module
 * Handles sidebar visibility and resizing
 */

import { sidebar } from "../core/dom";
import { state } from "../core/state";

/**
 * Toggle sidebar visibility
 */
export function toggleSidebar() {
  state.sidebarVisible = !state.sidebarVisible;
  if (state.sidebarVisible) {
    sidebar.classList.remove("collapsed");
  } else {
    sidebar.classList.add("collapsed");
  }
}

/**
 * Initialize sidebar resizing functionality
 */
export function initSidebarResize() {
  // Create resize handle
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "sidebar-resize-handle";
  sidebar.appendChild(resizeHandle);

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    resizeHandle.classList.add("resizing");
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    const delta = e.clientX - startX;
    const newWidth = startWidth + delta;

    // Enforce min and max width
    const minWidth = 150;
    const maxWidth = 600;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    sidebar.style.width = `${clampedWidth}px`;
    sidebar.style.minWidth = `${clampedWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      resizeHandle.classList.remove("resizing");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });
}
