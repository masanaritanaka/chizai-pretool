use keyring::Entry;

const SERVICE: &str = "chizai-pretool";
const USERNAME: &str = "claude-api-key";

fn entry() -> Result<Entry, String> {
  Entry::new(SERVICE, USERNAME).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
  entry()?.set_password(&key).map_err(|e| e.to_string())?;
  crate::claude_api::clear_key_cache();
  Ok(())
}

/// キーチェーンに保存済みのキーをマスクして返す。
/// フロントにキー全文を渡さないためのセキュリティ境界。
/// 戻り値形式: "sk-ant-...XXXX"（末尾4文字のみ表示）
#[tauri::command]
pub fn get_api_key_masked() -> Result<Option<String>, String> {
  match entry()?.get_password() {
    Ok(password) => {
      let trimmed = password.trim();
      if trimmed.is_empty() {
        return Ok(None);
      }
      let suffix = if trimmed.len() >= 4 {
        &trimmed[trimmed.len() - 4..]
      } else {
        trimmed
      };
      Ok(Some(format!("sk-ant-...{suffix}")))
    }
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
  let result = match entry()?.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  };
  crate::claude_api::clear_key_cache();
  result
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn round_trips_through_the_os_keychain() {
    delete_api_key().unwrap();
    assert_eq!(get_api_key_masked().unwrap(), None);

    save_api_key("sk-ant-test-12345".to_string()).unwrap();
    let masked = get_api_key_masked().unwrap().expect("key should be present");
    assert!(masked.starts_with("sk-ant-..."), "expected masked prefix: {masked}");
    assert!(masked.ends_with("2345"), "expected last-4 suffix: {masked}");

    delete_api_key().unwrap();
    assert_eq!(get_api_key_masked().unwrap(), None);
  }
}
