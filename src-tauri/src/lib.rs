mod keychain;
mod file_reader;
mod claude_api;

use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![
    Migration {
      version: 1,
      description: "create_initial_tables",
      sql: include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/db/schema.sql")),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "add_settings_table",
      sql: include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/db/v2_settings.sql")),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 3,
      description: "add_watch_targets_table",
      sql: include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/db/v3_watch_targets.sql")),
      kind: MigrationKind::Up,
    },
  ];

  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .plugin(tauri_plugin_shell::init())
    .plugin(SqlBuilder::default().add_migrations("sqlite:chizai-pretool.db", migrations).build())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![
      keychain::save_api_key,
      keychain::get_api_key_masked,
      keychain::delete_api_key,
      file_reader::read_dropped_file,
      claude_api::call_claude_api,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
