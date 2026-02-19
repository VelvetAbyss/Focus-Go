mod capture;
mod output;
mod overlay;
mod shortcut;
mod windows;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(shortcut::CaptureShortcutState::new(
                shortcut::DEFAULT_CAPTURE_SHORTCUT,
            ));
            app.manage(output::OutputDirectoryState::new(
                output::load_output_directory(&app.handle()),
            ));

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(|app, shortcut, event| {
                        shortcut::handle_shortcut_event(app, shortcut, event);
                    })
                    .build(),
            )?;
            app.handle().plugin(tauri_plugin_dialog::init())?;
            app.handle()
                .plugin(tauri_plugin_clipboard_manager::init())?;

            if let Err(error) = shortcut::ensure_default_capture_shortcut(
                &app.handle(),
                app.state::<shortcut::CaptureShortcutState>().inner(),
            ) {
                log::warn!("Failed to register default capture shortcut: {error}");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            capture::capture_screen,
            overlay::get_monitors,
            overlay::get_monitor_at_cursor,
            overlay::show_overlay,
            overlay::hide_overlay,
            output::get_output_directory,
            output::complete_capture_output,
            shortcut::get_capture_shortcut,
            shortcut::register_capture_shortcut,
            windows::get_windows
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
