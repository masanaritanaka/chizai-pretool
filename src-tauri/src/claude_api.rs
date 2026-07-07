use keyring::Entry;
use reqwest;
use std::sync::{Mutex, OnceLock};

const SERVICE: &str = "chizai-pretool";
const USERNAME: &str = "claude-api-key";

// プロセス内キーキャッシュ — 起動中に1回だけキーチェーンを開く
static KEY_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn key_cache() -> &'static Mutex<Option<String>> {
  KEY_CACHE.get_or_init(|| Mutex::new(None))
}

/// キャッシュをクリアする（キー保存・削除時に keychain.rs から呼ぶ）
pub(crate) fn clear_key_cache() {
  if let Ok(mut guard) = key_cache().lock() {
    *guard = None;
  }
}

/// Claude API を Rust 側で直接呼び出す。
/// APIキーは OS キーチェーンから直接取得するため、JS コンテキストにキーが渡らない。
/// 成功: レスポンス body (JSON 文字列)
/// 失敗: "NO_KEY" | "HTTP:{status}:{body}" | "NETWORK:{message}"
#[tauri::command]
pub async fn call_claude_api(body: String) -> Result<String, String> {
  // キャッシュを確認
  let cached = {
    let guard = key_cache()
      .lock()
      .map_err(|_| "NETWORK:cache lock error".to_string())?;
    guard.clone()
  };

  let api_key = match cached {
    Some(k) => k,
    None => {
      // キャッシュなし → キーチェーンから取得（macOS ダイアログが出るのはここだけ）
      let k = Entry::new(SERVICE, USERNAME)
        .map_err(|e| format!("NETWORK:keychain open error: {e}"))?
        .get_password()
        .map_err(|e| match e {
          keyring::Error::NoEntry => "NO_KEY".to_string(),
          other => format!("NETWORK:keychain read error: {other}"),
        })?;

      let k = k.trim().to_string();
      if k.is_empty() {
        return Err("NO_KEY".to_string());
      }

      // キャッシュに書き込む
      let mut guard = key_cache()
        .lock()
        .map_err(|_| "NETWORK:cache lock error".to_string())?;
      *guard = Some(k.clone());
      k
    }
  };

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
    // 認証エラー時はキャッシュを無効化（古いキーが残らないよう）
    if status == 401 {
      clear_key_cache();
    }
    Err(format!("HTTP:{status}:{text}"))
  }
}
