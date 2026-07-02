use std::path::Path;

const ALLOWED_EXTENSIONS: &[&str] = &[
  "txt", "md", "csv", "text",
  "html", "htm",
  "pdf",
  "docx",
  "xlsx", "xls",
  "jpg", "jpeg", "png", "gif", "webp",
];

const MAX_BYTES: u64 = 20 * 1024 * 1024; // 20 MB

/// Finder D&D でドロップされたファイルのバイト列を返す。
/// 拡張子ホワイトリスト + 20 MB 上限を検証してから読み込む。
/// UUID 方式（AppState にパスを保持）も検討したが、onDragDropEvent でパスがすでに
/// フロントに公開されるため隠蔽効果がなく、ホワイトリスト方式で実質的なリスクを網羅できると判断した。
#[tauri::command]
pub fn read_dropped_file(path: String) -> Result<Vec<u8>, String> {
  let p = Path::new(&path);

  // 拡張子チェック
  let ext = p
    .extension()
    .and_then(|e| e.to_str())
    .map(|e| e.to_lowercase())
    .unwrap_or_default();
  if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
    return Err(format!(
      "非対応の拡張子です（.{ext}）。対応: {}",
      ALLOWED_EXTENSIONS.join(" / ")
    ));
  }

  // ファイル存在確認
  if !p.exists() {
    return Err(format!("ファイルが見つかりません: {path}"));
  }

  // サイズチェック
  let meta = std::fs::metadata(p).map_err(|e| format!("メタデータ取得エラー: {e}"))?;
  if meta.len() > MAX_BYTES {
    return Err(format!(
      "ファイルサイズが上限（20 MB）を超えています（{}）。",
      path
    ));
  }

  std::fs::read(p).map_err(|e| format!("読み込みエラー ({path}): {e}"))
}
