use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// Tauri event emitted to the webview whenever a focusgo:// deep link arrives.
const DEEP_LINK_EVENT: &str = "deep-link-url";

const TRAY_ID: &str = "main-tray";

/// The quick-capture box (⌥Space): a small always-on-top window whose page lives in this
/// crate (quick-capture.html), served over its own protocol so it never touches the web build.
const QUICK_CAPTURE_LABEL: &str = "quick-capture";
/// Event carrying the captured text to the main window, which files it as a task.
const QUICK_CAPTURE_EVENT: &str = "quick-capture";
const QUICK_CAPTURE_SCHEME: &str = "fgcapture";
const QUICK_CAPTURE_HTML: &str = include_str!("../quick-capture.html");
#[cfg(windows)]
const QUICK_CAPTURE_URL: &str = "http://fgcapture.localhost/";
#[cfg(not(windows))]
const QUICK_CAPTURE_URL: &str = "fgcapture://localhost/";

/// The app's interface language as the web layer reports it ("zh" / "en"); empty until it does.
static UI_LANGUAGE: Mutex<String> = Mutex::new(String::new());

/// Set when the box was opened from another app, so finishing hands focus back to it.
static CAPTURE_FROM_ELSEWHERE: AtomicBool = AtomicBool::new(false);

/// The running focus session, as the web layer last reported it: when it ends (epoch ms),
/// or how much was left when it was paused (seconds). The tray ticks it down on its own,
/// because a hidden webview stops ticking.
static FOCUS_TIMER: Mutex<(Option<u64>, Option<u64>)> = Mutex::new((None, None));
static TRAY_TIMER_LABEL: Mutex<Option<String>> = Mutex::new(None);

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

fn hide_quick_capture(app: &AppHandle, hand_back: bool) {
    if let Some(window) = app.get_webview_window(QUICK_CAPTURE_LABEL) {
        let _ = window.hide();
    }
    let from_elsewhere = CAPTURE_FROM_ELSEWHERE.swap(false, Ordering::SeqCst);
    if !hand_back {
        return;
    }
    if from_elsewhere {
        // Back to whatever was in front before the shortcut (macOS activated us to show the box).
        #[cfg(target_os = "macos")]
        let _ = app.hide();
    } else if let Some(main) = app.get_webview_window("main") {
        let _ = main.set_focus();
    }
}

/// Enter navigates the box to /submit?text=…, Esc to /cancel. Neither navigation happens:
/// the text goes to the main window and the box hides.
fn handle_quick_capture_navigation(app: &AppHandle, url: &tauri::Url) -> bool {
    let path = url.path();
    if path != "/submit" && path != "/cancel" {
        return true;
    }
    if path == "/submit" {
        let text = url
            .query_pairs()
            .find(|(key, _)| key == "text")
            .map(|(_, value)| value.trim().to_string())
            .unwrap_or_default();
        if !text.is_empty() {
            let _ = app.emit_to("main", QUICK_CAPTURE_EVENT, text);
        }
    }
    // Leave the webview's navigation callback before touching windows.
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || hide_quick_capture(&handle, true));
    false
}

/// Show the quick-capture box, creating it the first time. Pressing the shortcut while it is
/// open closes it again.
fn open_quick_capture(app: &AppHandle) {
    let language = UI_LANGUAGE.lock().map(|lang| lang.clone()).unwrap_or_default();
    let in_app = app
        .get_webview_window("main")
        .and_then(|main| main.is_focused().ok())
        .unwrap_or(false);

    if let Some(window) = app.get_webview_window(QUICK_CAPTURE_LABEL) {
        if window.is_visible().unwrap_or(false) {
            hide_quick_capture(app, true);
            return;
        }
        CAPTURE_FROM_ELSEWHERE.store(!in_app, Ordering::SeqCst);
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.eval(format!("window.__fgReset && window.__fgReset({language:?})"));
        return;
    }

    let Ok(url) = format!("{QUICK_CAPTURE_URL}?lang={language}").parse() else {
        return;
    };
    CAPTURE_FROM_ELSEWHERE.store(!in_app, Ordering::SeqCst);
    let nav_handle = app.clone();
    let built = WebviewWindowBuilder::new(app, QUICK_CAPTURE_LABEL, WebviewUrl::CustomProtocol(url))
        .title("Focus & Go")
        .inner_size(560.0, 86.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .shadow(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .center()
        .focused(true)
        .on_navigation(move |url| handle_quick_capture_navigation(&nav_handle, url))
        .build();

    match built {
        Ok(window) => {
            // Clicking anywhere else puts it away, like Spotlight.
            let blur_handle = app.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    hide_quick_capture(&blur_handle, false);
                }
            });
            let _ = window.set_focus();
        }
        Err(err) => log::warn!("failed to open quick capture: {err}"),
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

fn format_clock(seconds: u64) -> String {
    let (h, m, s) = (seconds / 3600, (seconds % 3600) / 60, seconds % 60);
    if h > 0 {
        format!("{h}:{m:02}:{s:02}")
    } else {
        format!("{m:02}:{s:02}")
    }
}

/// What the menu bar shows next to the icon: the time left, a pause mark when paused,
/// nothing when no session is on.
fn tray_timer_label() -> Option<String> {
    let (ends_at, paused) = *FOCUS_TIMER.lock().ok()?;
    if let Some(ends_at) = ends_at {
        let remaining_ms = ends_at.saturating_sub(now_ms());
        if remaining_ms == 0 {
            return None;
        }
        return Some(format_clock(remaining_ms.div_ceil(1000)));
    }
    paused.map(|seconds| format!("\u{23F8}\u{FE0E} {}", format_clock(seconds)))
}

fn render_tray_timer(app: &AppHandle) {
    let label = tray_timer_label();
    {
        let Ok(mut last) = TRAY_TIMER_LABEL.lock() else {
            return;
        };
        if *last == label {
            return;
        }
        *last = label.clone();
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        // The title shows on the macOS menu bar; Windows has only the tooltip.
        let _ = tray.set_title(label.as_deref());
        let tooltip = match &label {
            Some(text) => format!("Focus & Go · {text}"),
            None => "Focus & Go".to_string(),
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

/// Frontend bridge: the focus session to show in the tray. Both None clears it.
#[tauri::command]
fn set_focus_timer(app: AppHandle, ends_at: Option<f64>, paused_seconds: Option<f64>) {
    if let Ok(mut timer) = FOCUS_TIMER.lock() {
        *timer = (
            ends_at.filter(|v| v.is_finite() && *v > 0.0).map(|v| v as u64),
            paused_seconds.filter(|v| v.is_finite() && *v > 0.0).map(|v| v as u64),
        );
    }
    render_tray_timer(&app);
}

/// Frontend bridge: the app's interface language, for the quick-capture box.
#[tauri::command]
fn set_ui_language(language: String) {
    if language == "zh" || language == "en" {
        if let Ok(mut current) = UI_LANGUAGE.lock() {
            *current = language;
        }
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

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
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
        .register_uri_scheme_protocol(QUICK_CAPTURE_SCHEME, |_ctx, _request| {
            tauri::http::Response::builder()
                .header("Content-Type", "text/html; charset=utf-8")
                .body(QUICK_CAPTURE_HTML.as_bytes().to_vec())
                .unwrap_or_default()
        })
        .invoke_handler(tauri::generate_handler![
            notify,
            show_main_window,
            open_external,
            get_initial_deep_link,
            auth_save_token,
            auth_load_token,
            auth_clear_token,
            set_focus_timer,
            set_ui_language
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

            // Tick the tray countdown once a second (cheap: the title only changes when the
            // label does).
            {
                let tick_handle = handle.clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(Duration::from_secs(1));
                    render_tray_timer(&tick_handle);
                });
            }

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

            // Global shortcuts: Cmd/Ctrl+Shift+F brings Focus & Go to the front from anywhere;
            // Option/Alt+Space opens the quick-capture box.
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };

                let toggle = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyF);
                let capture = Shortcut::new(Some(Modifiers::ALT), Code::Space);
                let toggle_for_handler = toggle.clone();
                let capture_for_handler = capture.clone();
                handle.plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }
                            if shortcut == &toggle_for_handler {
                                focus_main_window(app);
                            } else if shortcut == &capture_for_handler {
                                // Creating a webview from the main thread's own handler can
                                // deadlock on Windows; do it from a worker.
                                let handle = app.clone();
                                std::thread::spawn(move || open_quick_capture(&handle));
                            }
                        })
                        .build(),
                )?;
                if let Err(err) = app.global_shortcut().register(toggle) {
                    log::warn!("failed to register global shortcut: {err}");
                }
                if let Err(err) = app.global_shortcut().register(capture) {
                    log::warn!("failed to register quick-capture shortcut: {err}");
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
