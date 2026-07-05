use keyring::Entry;
use reqwest;

const SERVICE: &str = "chizai-pretool";
const USERNAME: &str = "claude-api-key";

/// Claude API を Rust 側で直接呼び出す。
/// APIキーは OS キーチェーンから直接取得するため、JS コンテキストにキーが渡らない。
/// 成功: レスポンス body (JSON 文字列)
/// 失敗: "NO_KEY" | "HTTP:{status}:{body}" | "NETWORK:{message}"
#[tauri::command]
pub async fn call_claude_api(body: String) -> Result<String, String> {
  // キーをキーチェーンから直接取得 — JS から引数で受け取らない
  let api_key = Entry::new(SERVICE, USERNAME)
    .map_err(|e| format!("NETWORK:keychain open error: {e}"))?
    .get_password()
    .map_err(|e| match e {
      keyring::Error::NoEntry => "NO_KEY".to_string(),
      other => format!("NETWORK:keychain read error: {other}"),
    })?;

  let api_key = api_key.trim().to_string();
  if api_key.is_empty() {
    return Err("NO_KEY".to_string());
  }

  let client = reqwest::Client::new();

  let resp = client
    .post("https://api.anthropic.com/v1/messages")
    .header("content-type", "application/json")
    .header("x-api-key", &api_key)
    .header("anthropic-version", "2023-06-01")
    .body(body)
    .send()
    .await
    .map_err(|e| format!("NETWORK:{e}"))?;

  let status = resp.status().as_u16();
  let text = resp.text().await.map_err(|e| format!("READ:{e}"))?;

  if status == 200 {
    Ok(text)
  } else {
    Err(format!("HTTP:{status}:{text}"))
  }
}
