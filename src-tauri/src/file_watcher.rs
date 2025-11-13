use notify::{Watcher, RecursiveMode, Event};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSystemEvent {
    pub event_type: String,
    pub path: String,
}

pub struct FileWatcherState {
    watcher: Option<notify::RecommendedWatcher>,
}

impl FileWatcherState {
    pub fn new() -> Self {
        Self { watcher: None }
    }

    pub fn start_watching<P: AsRef<Path>>(
        &mut self,
        path: P,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Stop any existing watcher first
        self.stop_watching();

        let path = path.as_ref().to_path_buf();

        // Verify the path exists and is a directory
        if !path.exists() {
            return Err("Path does not exist".to_string());
        }
        if !path.is_dir() {
            return Err("Path is not a directory".to_string());
        }

        // Create a new watcher
        let watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            match res {
                Ok(event) => {
                    // Filter out events we don't care about
                    match event.kind {
                        notify::EventKind::Create(_) |
                        notify::EventKind::Remove(_) |
                        notify::EventKind::Modify(notify::event::ModifyKind::Name(_)) => {
                            // Determine the event type
                            let event_type = match event.kind {
                                notify::EventKind::Create(_) => "create",
                                notify::EventKind::Remove(_) => "delete",
                                notify::EventKind::Modify(notify::event::ModifyKind::Name(_)) => "rename",
                                _ => "modify",
                            };

                            // Get the first path from the event
                            if let Some(path) = event.paths.first() {
                                let path_str = path.to_string_lossy().to_string();

                                // Skip hidden files/folders (starting with .)
                                if let Some(name) = path.file_name() {
                                    let name_str = name.to_string_lossy();
                                    if name_str.starts_with('.') {
                                        return;
                                    }
                                }

                                let fs_event = FileSystemEvent {
                                    event_type: event_type.to_string(),
                                    path: path_str,
                                };

                                // Emit the event to the frontend
                                if let Err(e) = app_handle.emit("file-system-change", fs_event) {
                                    eprintln!("Failed to emit file system event: {}", e);
                                }
                            }
                        }
                        _ => {
                            // Ignore other event types (metadata changes, content modifications, etc.)
                        }
                    }
                }
                Err(e) => eprintln!("File watcher error: {:?}", e),
            }
        }).map_err(|e| format!("Failed to create watcher: {}", e))?;

        // Store the watcher before calling watch
        self.watcher = Some(watcher);

        // Now watch the directory
        if let Some(ref mut watcher) = self.watcher {
            watcher.watch(&path, RecursiveMode::Recursive)
                .map_err(|e| format!("Failed to watch directory: {}", e))?;
        }

        println!("Started watching directory: {:?}", path);
        Ok(())
    }

    pub fn stop_watching(&mut self) {
        if let Some(watcher) = self.watcher.take() {
            // The watcher will automatically stop when dropped
            drop(watcher);
            println!("Stopped watching directory");
        }
    }
}

// Global state wrapped in Arc<Mutex<>> for thread-safe access
pub type FileWatcherStateHandle = Arc<Mutex<FileWatcherState>>;

pub fn create_watcher_state() -> FileWatcherStateHandle {
    Arc::new(Mutex::new(FileWatcherState::new()))
}
