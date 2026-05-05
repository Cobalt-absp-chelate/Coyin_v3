use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadPaperRequest {
    pub url: String,
    pub title: String,
    pub safe_filename: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadPaperResponse {
    pub success: bool,
    pub local_path: String,
    pub file_size: u64,
    pub error: Option<String>,
}

fn sanitize_filename(name: &str) -> String {
    // Keep only safe characters, replace unsafe ones with underscores
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim()
        .replace("  ", " ")
        .replace(' ', "_")
}

#[tauri::command]
pub async fn download_paper_pdf(
    request: DownloadPaperRequest,
    app_handle: tauri::AppHandle,
) -> Result<DownloadPaperResponse, String> {
    let url = &request.url;
    eprintln!("[download-paper] START url={url}");

    // 1. Download the PDF
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;

    eprintln!("[download-paper] fetching...");
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {e}"))?;

    let status = response.status().as_u16();
    eprintln!("[download-paper] HTTP {status}");

    if status < 200 || status >= 300 {
        return Err(format!("下载失败: HTTP {status}"));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取响应内容失败: {e}"))?;

    eprintln!("[download-paper] downloaded {} bytes", bytes.len());

    if bytes.is_empty() {
        return Err("下载内容为空".into());
    }

    // 2. Validate PDF magic bytes
    if bytes.len() < 4 || bytes[0] != 0x25 || bytes[1] != 0x50 || bytes[2] != 0x44 || bytes[3] != 0x46 {
        return Err(format!(
            "文件不是合法 PDF（文件头: {:02X} {:02X} {:02X} {:02X}）",
            bytes[0], bytes[1], bytes[2], bytes[3]
        ));
    }

    // 3. Determine save path
    let papers_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取 app data 目录失败: {e}"))?
        .join("papers");

    std::fs::create_dir_all(&papers_dir)
        .map_err(|e| format!("创建 papers 目录失败 ({papers_dir:?}): {e}"))?;

    let safe_name = if request.safe_filename.is_empty() {
        sanitize_filename(&request.title)
    } else {
        sanitize_filename(&request.safe_filename)
    };

    let final_name = if safe_name.is_empty() {
        format!("paper_{}.pdf", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs())
    } else {
        format!("{safe_name}.pdf")
    };

    let dest_path = papers_dir.join(&final_name);

    // 4. Atomic write: write to .tmp first, then rename
    let tmp_path = papers_dir.join(format!(".{final_name}.tmp"));
    std::fs::write(&tmp_path, &bytes)
        .map_err(|e| format!("写入临时文件失败 ({tmp_path:?}): {e}"))?;

    std::fs::rename(&tmp_path, &dest_path)
        .map_err(|e| format!("重命名文件失败 ({tmp_path:?} → {dest_path:?}): {e}"))?;

    // 5. Verify written file
    let metadata = std::fs::metadata(&dest_path)
        .map_err(|e| format!("读取文件元数据失败 ({dest_path:?}): {e}"))?;

    let file_size = metadata.len();
    if file_size == 0 {
        std::fs::remove_file(&dest_path).ok();
        return Err("写入后文件大小为 0，已删除空文件".into());
    }

    let local_path = dest_path.to_string_lossy().to_string();
    eprintln!(
        "[download-paper] SUCCESS path={local_path} size={file_size} bytes"
    );

    Ok(DownloadPaperResponse {
        success: true,
        local_path,
        file_size,
        error: None,
    })
}
