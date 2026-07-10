use keyring::Entry;

const SERVICE: &str = "chizai-pretool";
const USERNAME: &str = "claude-api-key";

fn entry_for(service: &str) -> Result<Entry, String> {
  Entry::new(service, USERNAME).map_err(|e| e.to_string())
}

fn entry() -> Result<Entry, String> {
  entry_for(SERVICE)
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
      let chars: Vec<char> = trimmed.chars().collect();
      let suffix: String = if chars.len() >= 4 {
        chars[chars.len() - 4..].iter().collect()
      } else {
        chars.iter().collect()
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
  use keyring::Entry;

  const USERNAME: &str = "claude-api-key";

  struct TestKeychain {
    entry: Entry,
  }

  impl TestKeychain {
    fn new(service: &str) -> Self {
      let entry = Entry::new(service, USERNAME).expect("failed to create test keychain entry");
      // 前の実行が残したエントリを消してから始める
      let _ = entry.delete_credential();
      Self { entry }
    }

    fn save(&self, key: &str) {
      self.entry.set_password(key).expect("test save failed");
    }

    fn get_masked(&self) -> Option<String> {
      match self.entry.get_password() {
        Ok(pw) => {
          let trimmed = pw.trim();
          if trimmed.is_empty() { return None; }
          let chars: Vec<char> = trimmed.chars().collect();
          let suffix: String = if chars.len() >= 4 {
            chars[chars.len() - 4..].iter().collect()
          } else {
            chars.iter().collect()
          };
          Some(format!("sk-ant-...{suffix}"))
        }
        Err(keyring::Error::NoEntry) => None,
        Err(e) => panic!("get_masked failed: {e}"),
      }
    }

    fn delete(&self) {
      match self.entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(e) => panic!("delete failed: {e}"),
      }
    }
  }

  impl Drop for TestKeychain {
    fn drop(&mut self) {
      let _ = self.entry.delete_credential();
    }
  }

  #[test]
  fn round_trips_through_the_os_keychain() {
    // 本番 SERVICE ("chizai-pretool") には一切触れない。各テストは固有サービス名を使う。
    let kc = TestKeychain::new("chizai-pretool-test-roundtrip");
    assert_eq!(kc.get_masked(), None);

    kc.save("sk-ant-test-12345");
    let masked = kc.get_masked().expect("key should be present");
    assert!(masked.starts_with("sk-ant-..."), "expected masked prefix: {masked}");
    assert!(masked.ends_with("2345"), "expected last-4 suffix: {masked}");

    kc.delete();
    assert_eq!(kc.get_masked(), None);
  }

  #[test]
  fn masked_key_handles_multibyte_suffix() {
    let kc = TestKeychain::new("chizai-pretool-test-multibyte");
    // "あいう絵お" — 5文字のマルチバイト文字列、末尾4文字は "いう絵お"
    kc.save("sk-ant-あいう絵お");
    let masked = kc.get_masked().expect("key should be present");
    assert!(masked.ends_with("いう絵お"), "expected multibyte suffix: {masked}");
  }
}
