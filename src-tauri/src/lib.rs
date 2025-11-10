mod markdown;
use markdown::{render_markdown_line, LineRenderResult, RenderRequest};

// Markdown rendering commands
#[tauri::command]
fn render_markdown(request: RenderRequest) -> LineRenderResult {
    render_markdown_line(request)
}

// Batch rendering for multiple lines (parallelized for performance)
#[tauri::command]
fn render_markdown_batch(requests: Vec<RenderRequest>) -> Vec<LineRenderResult> {
    use rayon::prelude::*;

    // Use parallel iterator for large batches (>50 lines)
    if requests.len() > 50 {
        requests.into_par_iter().map(render_markdown_line).collect()
    } else {
        // For small batches, sequential is faster (no thread overhead)
        requests.into_iter().map(render_markdown_line).collect()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            render_markdown,
            render_markdown_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}