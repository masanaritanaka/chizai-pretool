use keyring::Entry;
use serde_json::{json, Value};

const NOTION_SERVICE: &str = "chizai-pretool-notion";
const NOTION_USERNAME: &str = "notion-token";
const NOTION_VERSION: &str = "2022-06-28";

fn notion_entry() -> Result<Entry, String> {
  Entry::new(NOTION_SERVICE, NOTION_USERNAME).map_err(|e| e.to_string())
}

fn get_notion_token() -> Result<String, String> {
  match notion_entry()?.get_password() {
    Ok(t) if !t.trim().is_empty() => Ok(t.trim().to_string()),
    Ok(_) => Err("NO_TOKEN".to_string()),
    Err(keyring::Error::NoEntry) => Err("NO_TOKEN".to_string()),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
pub fn save_notion_token(token: String) -> Result<(), String> {
  notion_entry()?.set_password(token.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_notion_token() -> Result<bool, String> {
  match notion_entry()?.get_password() {
    Ok(t) => Ok(!t.trim().is_empty()),
    Err(keyring::Error::NoEntry) => Ok(false),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
pub fn delete_notion_token() -> Result<(), String> {
  match notion_entry()?.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}

/// Notion トークンの疎通確認: GET /v1/users/me → ボット名を返す
#[tauri::command]
pub async fn test_notion_connection() -> Result<String, String> {
  let token = get_notion_token().map_err(|_| "Notionトークンが設定されていません".to_string())?;
  let client = reqwest::Client::new();
  let resp = client
    .get("https://api.notion.com/v1/users/me")
    .header("Authorization", format!("Bearer {token}"))
    .header("Notion-Version", NOTION_VERSION)
    .send()
    .await
    .map_err(|e| format!("ネットワークエラー: {e}"))?;

  let status = resp.status().as_u16();
  let text = resp.text().await.map_err(|e| format!("レスポンス読み取りエラー: {e}"))?;

  if status == 200 {
    let data: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let name = data["name"].as_str().unwrap_or("(接続成功)");
    Ok(name.to_string())
  } else if status == 401 {
    Err("トークンが無効です（401）。Notion のインテグレーションページで再発行してください。".to_string())
  } else {
    Err(format!("HTTP {status}: {}", &text[..text.len().min(200)]))
  }
}

/// テキストを Notion の 2000 文字制限で分割してパラグラフブロック配列を返す
fn text_to_para_blocks(text: &str) -> Vec<Value> {
  if text.is_empty() {
    return vec![];
  }
  // Notion rich_text は 2000 chars 制限
  text
    .chars()
    .collect::<Vec<_>>()
    .chunks(1800)
    .map(|chunk| {
      let content: String = chunk.iter().collect();
      json!({
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [{"type": "text", "text": {"content": content}}]
        }
      })
    })
    .collect()
}

fn heading2(text: &str) -> Value {
  json!({
    "object": "block",
    "type": "heading_2",
    "heading_2": {
      "rich_text": [{"type": "text", "text": {"content": text}}]
    }
  })
}

fn bulleted_item(text: &str) -> Value {
  json!({
    "object": "block",
    "type": "bulleted_list_item",
    "bulleted_list_item": {
      "rich_text": [{"type": "text", "text": {"content": &text[..text.len().min(1800)].to_string()}}]
    }
  })
}

fn numbered_item(text: &str) -> Value {
  json!({
    "object": "block",
    "type": "numbered_list_item",
    "numbered_list_item": {
      "rich_text": [{"type": "text", "text": {"content": &text[..text.len().min(1800)].to_string()}}]
    }
  })
}

/// IdeaMemo04Output の JSON を Notion ブロック配列に変換する
fn memo_json_to_blocks(memo: &Value) -> Vec<Value> {
  let mut blocks: Vec<Value> = vec![];

  if let Some(core) = memo["core"].as_str().filter(|s| !s.is_empty()) {
    blocks.push(heading2("アイデアの核"));
    blocks.extend(text_to_para_blocks(core));
  }

  if let Some(nf) = memo["noveltyFocus"].as_str().filter(|s| !s.is_empty()) {
    blocks.push(heading2("新規性の焦点"));
    blocks.extend(text_to_para_blocks(nf));
  }

  if let Some(kws) = memo["keywords"].as_array() {
    if !kws.is_empty() {
      blocks.push(heading2("先行調査キーワード"));
      for kw in kws {
        let element = kw["element"].as_str().unwrap_or("");
        let ja: Vec<&str> = kw["ja"].as_array()
          .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
          .unwrap_or_default();
        let en: Vec<&str> = kw["en"].as_array()
          .map(|a| a.iter().filter_map(|v| v.as_str()).collect())
          .unwrap_or_default();
        let ja_str = ja.join(" / ");
        let en_str = en.join(" / ");
        let text = format!("{element}　JP: {ja_str}　EN: {en_str}");
        blocks.push(bulleted_item(&text));
      }
    }
  }

  if let Some(alts) = memo["alternatives"].as_array() {
    if !alts.is_empty() {
      blocks.push(heading2("差別化・回避設計の選択肢"));
      for alt in alts {
        if let Some(t) = alt.as_str() {
          blocks.push(numbered_item(t));
        }
      }
    }
  }

  if let Some(checks) = memo["preConsultChecklist"].as_array() {
    if !checks.is_empty() {
      blocks.push(heading2("弁理士相談前チェックリスト"));
      for item in checks {
        if let Some(t) = item.as_str() {
          blocks.push(numbered_item(t));
        }
      }
    }
  }

  blocks
}

/// メモを Notion データベースのページとして送信する。
/// メモデータ(title, memo_json, tags)はJSから渡す。Notionトークンはキーチェーンから取得。
#[tauri::command]
pub async fn send_to_notion(
  title: String,
  memo_json: String,
  tags: String,
  database_id: String,
) -> Result<String, String> {
  let token = get_notion_token()
    .map_err(|_| "Notionトークンが設定されていません。設定画面で登録してください。".to_string())?;

  let memo: Value = serde_json::from_str(&memo_json)
    .map_err(|e| format!("メモデータのパースに失敗しました: {e}"))?;

  let mut properties = json!({
    "Name": {
      "title": [{"text": {"content": &title[..title.len().min(2000)]}}]
    }
  });

  // tags が空でなければ multi_select に追加（DB にプロパティがなければ API 側でエラー → JS でハンドル）
  let tag_list: Vec<&str> = tags
    .split(',')
    .map(|t| t.trim())
    .filter(|t| !t.is_empty())
    .collect();
  if !tag_list.is_empty() {
    properties["Tags"] = json!({
      "multi_select": tag_list.iter().map(|t| json!({"name": t})).collect::<Vec<_>>()
    });
  }

  let children = memo_json_to_blocks(&memo);

  // Notion は一度に 100 ブロックまで。ここでは 50 以下なので安全。
  let body = json!({
    "parent": {"type": "database_id", "database_id": database_id},
    "properties": properties,
    "children": children
  });

  let client = reqwest::Client::new();
  let resp = client
    .post("https://api.notion.com/v1/pages")
    .header("Authorization", format!("Bearer {token}"))
    .header("Notion-Version", NOTION_VERSION)
    .header("Content-Type", "application/json")
    .body(body.to_string())
    .send()
    .await
    .map_err(|e| format!("ネットワークエラー: {e}"))?;

  let status = resp.status().as_u16();
  let text = resp.text().await.map_err(|e| format!("レスポンス読み取りエラー: {e}"))?;

  if status == 200 || status == 201 {
    let data: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let url = data["url"]
      .as_str()
      .ok_or_else(|| "Notion ページ URL が取得できませんでした".to_string())?;
    Ok(url.to_string())
  } else if status == 401 {
    Err("Notionトークンが無効です（401）。設定画面で再設定してください。".to_string())
  } else if status == 404 {
    Err("データベースが見つかりません（404）。データベースIDを確認し、インテグレーションをデータベースに接続してください。".to_string())
  } else {
    Err(format!(
      "Notion API エラー HTTP {status}: {}",
      &text[..text.len().min(300)]
    ))
  }
}
