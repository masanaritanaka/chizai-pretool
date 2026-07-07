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

#[tauri::command]
pub fn get_api_key() -> Result<Option<String>, String> {
  match entry()?.get_password() {
    Ok(password) => Ok(Some(password)),
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
    assert_eq!(get_api_key().unwrap(), None);

    save_api_key("sk-ant-test-12345".to_string()).unwrap();
    assert_eq!(get_api_key().unwrap(), Some("sk-ant-test-12345".to_string()));

    delete_api_key().unwrap();
    assert_eq!(get_api_key().unwrap(), None);
  }
}
