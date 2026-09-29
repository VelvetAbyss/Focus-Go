use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

/// Tauri event emitted to the webview whenever a focusgo:// deep link arrives.
const DEEP_LINK_EVENT: &str = "deep-link-url";

#[cfg(desktop)]
use tauri_plugin_notification::NotificationExt;

/// Bring the main window to the foreground (used by tray, single-instance, global shortcut).
fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Frontend bridge: show a native OS notification.
/// Called from the web layer via `invoke('notify', { title, body })` behind an `isTauri()` guard.
#[tauri::command]
fn notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        app.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, title, body);
        Ok(())
    }
}

/// Reveal the main window. It is created hidden (tauri.conf `visible: false`) and
/// shown only after the webview's first paint, so there is no white/theme flash.
#[tauri::command]
fn show_main_window(app: AppHandle) {
    focus_main_window(&app);
}

/// Open a URL in the user's default system browser (used for the Google OAuth
/// flow on desktop, which must NOT happen inside the embedded webview).
#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Return the deep link the app was cold-started with, if any (focusgo://...).
/// Live deep links arrive via the `deep-link-url` event instead.
#[tauri::command]
fn get_initial_deep_link(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        match app.deep_link().get_current() {
            Ok(Some(urls)) => Ok(urls.into_iter().next().map(|u| u.to_string())),
            Ok(None) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Ok(None)
    }
}

const KEYCHAIN_SERVICE: &str = "art.nestflow.focusgo";
const KEYCHAIN_ACCOUNT: &str = "auth-token";

/// Persist the auth token in the OS keychain (macOS Keychain / Windows Credential
/// Manager) — never in JS-readable localStorage.
#[tauri::command]
fn auth_save_token(token: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let entry =
            keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())?;
        entry.set_password(&token).map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        let _ = token;
        Ok(())
    }
}

/// Load the persisted auth token, if any. Returns None when nothing is stored.
#[tauri::command]
fn auth_load_token() -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        let entry =
            keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(desktop))]
    {
        Ok(None)
    }
}

/// Remove the persisted auth token (sign-out).
#[tauri::command]
fn auth_clear_token() -> Result<(), String> {
    #[cfg(desktop)]
    {
        let entry =
            keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(desktop))]
    {
        Ok(())
    }
}

/// Native application menu. On macOS a custom menu replaces the system default,
/// so we must re-add Edit items or Cmd+C/V/X stop working inside the webview.
fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let app_menu = Submenu::with_items(
        app,
        "Focus & Go",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("Focus & Go"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &PredefinedMenuItem::fullscreen(app, None)?,
            &PredefinedMenuItem::minimize(app, None)?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu])
}

/// System tray (menu bar on macOS) with Show / Quit.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show Focus & Go", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Focus & Go")
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => focus_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single instance MUST be registered before any other plugin. A second launch
    // (including a focusgo:// deep link on Windows/Linux) is forwarded to the
    // running app, which we surface to the webview via the deep-link event.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            focus_main_window(app);
            if let Some(url) = args.iter().find(|a| a.starts_with("focusgo://")) {
                let _ = app.emit(DEEP_LINK_EVENT, url.clone());
            }
        }));
        builder = builder.plugin(tauri_plugin_window_state::Builder::default().build());
        builder = builder.plugin(tauri_plugin_deep_link::init());
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
        builder = builder.plugin(tauri_plugin_process::init());
    }

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            notify,
            show_main_window,
            open_external,
            get_initial_deep_link,
            auth_save_token,
            auth_load_token,
            auth_clear_token
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle();
            let menu = build_app_menu(handle)?;
            app.set_menu(menu)?;
            build_tray(handle)?;

            // Safety net: the window is created hidden and revealed by the frontend
            // after first paint. If the webview never calls show_main_window (e.g. a
            // JS bootstrap failure), reveal it anyway after a few seconds so the app
            // can never get stuck invisible.
            {
                let safety_handle = handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(4));
                    if let Some(window) = safety_handle.get_webview_window("main") {
                        if !window.is_visible().unwrap_or(true) {
                            let _ = window.show();
                        }
                    }
                });
            }

            // Deep links (macOS delivers them via on_open_url, both cold and warm
            // start). Forward each focusgo:// URL to the webview as an event; the
            // frontend completes the Google sign-in by exchanging the one-time code.
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let dl_handle = handle.clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let _ = dl_handle.emit(DEEP_LINK_EVENT, url.to_string());
                    }
                });
            }

            // Global shortcut: Cmd/Ctrl+Shift+F brings Focus & Go to the front from anywhere.
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };

                let toggle = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyF);
                let toggle_for_handler = toggle.clone();
                handle.plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed
                                && shortcut == &toggle_for_handler
                            {
                                focus_main_window(app);
                            }
                        })
                        .build(),
                )?;
                if let Err(err) = app.global_shortcut().register(toggle) {
                    log::warn!("failed to register global shortcut: {err}");
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
