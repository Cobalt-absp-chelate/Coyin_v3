use base64::Engine as _;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AiHttpRequest {
    pub url: String,
    pub method: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub timeout_secs: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiHttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<(String, String)>,
    /// Always base64-encoded so binary responses (PDF) survive the string boundary.
    pub body: String,
    pub body_base64: bool,
    pub error: Option<String>,
}

fn redact_url(url: &str) -> String {
    // Strip query params and fragments for logging — keep only scheme + host + path
    match url.find('?') {
        Some(pos) => format!("{}/?...", &url[..pos]),
        None => url.to_string(),
    }
}

#[tauri::command]
pub async fn ai_http_request(request: AiHttpRequest) -> Result<AiHttpResponse, String> {
    let sanitized = redact_url(&request.url);
    let method = request.method.to_uppercase();

    // Validate URL protocol — only http and https are allowed
    let url_lower = request.url.to_lowercase();
    if !url_lower.starts_with("http://") && !url_lower.starts_with("https://") {
        eprintln!("[ai_http] {} {} -> REJECTED: unsupported protocol", method, sanitized);
        return Err("不支持的协议：仅允许 http/https".into());
    }

    // Clamp timeout to safe range
    let timeout_secs = request.timeout_secs.max(1).min(120);

    eprintln!("[ai_http] {} {} (timeout={}s)", method, sanitized, timeout_secs);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| {
            eprintln!("[ai_http] {} {} -> CLIENT_ERR: {e}", method, sanitized);
            format!("创建 HTTP 客户端失败: {e}")
        })?;

    let mut req = match method.as_str() {
        "GET" => client.get(&request.url),
        "POST" => client.post(&request.url),
        _ => {
            eprintln!("[ai_http] {} {} -> REJECTED: unsupported method", method, sanitized);
            return Err(format!("不支持的 HTTP 方法: {method}"));
        }
    };

    // Set headers (skip Authorization in debug output)
    for (key, value) in &request.headers {
        let lower = key.to_lowercase();
        if lower != "authorization" && lower != "x-api-key" {
            // safe to log
        }
        req = req.header(key.as_str(), value.as_str());
    }

    // Set body for POST requests
    if let Some(body) = &request.body {
        if !request
            .headers
            .iter()
            .any(|(k, _)| k.to_lowercase() == "content-type")
        {
            req = req.header("Content-Type", "application/json");
        }
        req = req.body(body.clone());
    }

    // Send request
    match req.send().await {
        Ok(res) => {
            let status = res.status().as_u16();
            let status_text = res.status().canonical_reason().unwrap_or("").to_string();

            if status >= 200 && status < 300 {
                eprintln!("[ai_http] {} {} -> {} {}", method, sanitized, status, status_text);
            } else {
                eprintln!("[ai_http] {} {} -> {} {} (non-2xx)", method, sanitized, status, status_text);
            }

            // Collect response headers (skip Set-Cookie for safety)
            let res_headers: Vec<(String, String)> = res
                .headers()
                .iter()
                .filter(|(k, _)| k.as_str().to_lowercase() != "set-cookie")
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
                .collect();

            let full_body_bytes = res.bytes().await.unwrap_or_default();
            let body = base64::engine::general_purpose::STANDARD.encode(&full_body_bytes);

            Ok(AiHttpResponse {
                status,
                status_text,
                headers: res_headers,
                body,
                body_base64: true,
                error: None,
            })
        }
        Err(e) => {
            let error_msg = if e.is_timeout() {
                eprintln!("[ai_http] {} {} -> TIMEOUT", method, sanitized);
                format!("请求超时 ({sanitized})，请检查网络或确认 Base URL 正确")
            } else if e.is_connect() {
                eprintln!("[ai_http] {} {} -> CONNECT_ERR: {e}", method, sanitized);
                format!("Base URL 不可达 ({sanitized})，无法连接到服务器")
            } else if e.is_request() {
                eprintln!("[ai_http] {} {} -> REQUEST_ERR: {e}", method, sanitized);
                format!("请求发送失败 ({sanitized}): {e}")
            } else {
                eprintln!("[ai_http] {} {} -> NET_ERR: {e}", method, sanitized);
                format!("网络错误 ({sanitized}): {e}")
            };
            Err(error_msg)
        }
    }
}
