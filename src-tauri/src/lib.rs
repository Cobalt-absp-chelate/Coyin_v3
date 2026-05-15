mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::ai_http::ai_http_request,
            commands::download_paper::download_paper_pdf,
            commands::chat_session::create_chat_session,
            commands::chat_session::list_chat_sessions,
            commands::chat_session::get_chat_messages,
            commands::chat_session::add_chat_message,
            commands::chat_session::delete_chat_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
