use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub thinking: Option<String>,
    pub timestamp: i64,
}

// ── helpers ──

fn sessions_dir(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取 app data 目录失败: {e}"))?
        .join("chat_sessions");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建 chat_sessions 目录失败: {e}"))?;
    Ok(dir)
}

fn sessions_file(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(sessions_dir(app_handle)?.join("sessions.json"))
}

fn messages_file(app_handle: &tauri::AppHandle, session_id: &str) -> Result<std::path::PathBuf, String> {
    let dir = sessions_dir(app_handle)?.join(session_id);
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("创建会话目录失败: {e}"))?;
    }
    Ok(dir.join("messages.json"))
}

fn load_sessions(app_handle: &tauri::AppHandle) -> Result<Vec<ChatSession>, String> {
    let path = sessions_file(app_handle)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取会话文件失败: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("解析会话数据失败: {e}"))
}

fn save_sessions(app_handle: &tauri::AppHandle, sessions: &[ChatSession]) -> Result<(), String> {
    let path = sessions_file(app_handle)?;
    let raw = serde_json::to_string_pretty(sessions).map_err(|e| format!("序列化会话失败: {e}"))?;
    std::fs::write(&path, raw).map_err(|e| format!("写入会话文件失败: {e}"))
}

fn load_messages(app_handle: &tauri::AppHandle, session_id: &str) -> Result<Vec<ChatMessage>, String> {
    let path = messages_file(app_handle, session_id)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("读取消息文件失败: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("解析消息数据失败: {e}"))
}

fn save_messages(app_handle: &tauri::AppHandle, session_id: &str, messages: &[ChatMessage]) -> Result<(), String> {
    let path = messages_file(app_handle, session_id)?;
    let raw = serde_json::to_string_pretty(messages).map_err(|e| format!("序列化消息失败: {e}"))?;
    std::fs::write(&path, raw).map_err(|e| format!("写入消息文件失败: {e}"))
}

// ── commands ──

#[tauri::command]
pub async fn create_chat_session(title: String, app_handle: tauri::AppHandle) -> Result<ChatSession, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let session = ChatSession {
        id: format!("chat-{now}"),
        title: if title.is_empty() { "新对话".to_string() } else { title },
        created_at: now,
        updated_at: now,
    };
    let mut sessions = load_sessions(&app_handle)?;
    sessions.push(session.clone());
    save_sessions(&app_handle, &sessions)?;
    save_messages(&app_handle, &session.id, &[])?;
    Ok(session)
}

#[tauri::command]
pub async fn list_chat_sessions(app_handle: tauri::AppHandle) -> Result<Vec<ChatSession>, String> {
    let mut sessions = load_sessions(&app_handle)?;
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(sessions)
}

#[tauri::command]
pub async fn get_chat_messages(session_id: String, app_handle: tauri::AppHandle) -> Result<Vec<ChatMessage>, String> {
    load_messages(&app_handle, &session_id)
}

#[tauri::command]
pub async fn add_chat_message(
    session_id: String,
    role: String,
    content: String,
    thinking: Option<String>,
    timestamp: i64,
    app_handle: tauri::AppHandle,
) -> Result<ChatMessage, String> {
    let msg = ChatMessage {
        id: format!("msg-{}-{}", timestamp, role),
        session_id: session_id.clone(),
        role,
        content,
        thinking,
        timestamp,
    };
    let mut messages = load_messages(&app_handle, &session_id)?;
    messages.push(msg.clone());
    save_messages(&app_handle, &session_id, &messages)?;

    // Update session updated_at
    let mut sessions = load_sessions(&app_handle)?;
    if let Some(s) = sessions.iter_mut().find(|s| s.id == session_id) {
        s.updated_at = timestamp;
        // Auto-title: use first user message if title is default
        if s.title == "新对话" && msg.role == "user" {
            s.title = msg.content.chars().take(30).collect::<String>();
            if msg.content.len() > 30 { s.title.push_str("…"); }
        }
    }
    save_sessions(&app_handle, &sessions)?;

    Ok(msg)
}

#[tauri::command]
pub async fn delete_chat_session(session_id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut sessions = load_sessions(&app_handle)?;
    sessions.retain(|s| s.id != session_id);
    save_sessions(&app_handle, &sessions)?;

    let dir = sessions_dir(&app_handle)?.join(&session_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("删除会话目录失败: {e}"))?;
    }
    Ok(())
}
