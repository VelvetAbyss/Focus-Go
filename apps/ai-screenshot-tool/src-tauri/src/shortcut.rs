use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Runtime, State};
use tauri_plugin_global_shortcut::{
    GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState as ShortcutKeyState,
};

pub const DEFAULT_CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+X";
pub const CAPTURE_SHORTCUT_EVENT: &str = "focusgo://capture-shortcut";

#[derive(Default)]
pub struct CaptureShortcutState {
    shortcut: Mutex<String>,
}

impl CaptureShortcutState {
    pub fn new(default_shortcut: &str) -> Self {
        Self {
            shortcut: Mutex::new(default_shortcut.to_string()),
        }
    }

    pub fn get(&self) -> String {
        self.shortcut.lock().unwrap().clone()
    }

    pub fn set(&self, shortcut: String) {
        *self.shortcut.lock().unwrap() = shortcut;
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutTriggeredPayload {
    pub shortcut: String,
}

pub trait ShortcutRegistrar {
    fn is_registered(&self, shortcut: &str) -> bool;
    fn register_with_handler(&self, shortcut: &str) -> Result<(), String>;
    fn unregister(&self, shortcut: &str) -> Result<(), String>;
}

pub struct AppShortcutRegistrar<'a, R: Runtime> {
    app: &'a AppHandle<R>,
}

impl<'a, R: Runtime> AppShortcutRegistrar<'a, R> {
    pub fn new(app: &'a AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<'a, R: Runtime> ShortcutRegistrar for AppShortcutRegistrar<'a, R> {
    fn is_registered(&self, shortcut: &str) -> bool {
        self.app.global_shortcut().is_registered(shortcut)
    }

    fn register_with_handler(&self, shortcut: &str) -> Result<(), String> {
        self.app
            .global_shortcut()
            .on_shortcut(shortcut, handle_shortcut_event::<R>)
            .map_err(|error| format!("Shortcut registration failed: {error}"))
    }

    fn unregister(&self, shortcut: &str) -> Result<(), String> {
        self.app
            .global_shortcut()
            .unregister(shortcut)
            .map_err(|error| format!("Shortcut unregistration failed: {error}"))
    }
}

fn normalize_shortcut(input: &str) -> Result<String, String> {
    let normalized = input.trim().to_string();
    if normalized.is_empty() {
        return Err("Shortcut cannot be empty".to_string());
    }

    normalized
        .parse::<Shortcut>()
        .map(|_| normalized)
        .map_err(|error| format!("Invalid shortcut format: {error}"))
}

fn update_registered_shortcut<R: ShortcutRegistrar>(
    registrar: &R,
    current_shortcut: &str,
    next_shortcut: &str,
) -> Result<String, String> {
    let normalized = normalize_shortcut(next_shortcut)?;

    if current_shortcut == normalized && registrar.is_registered(&normalized) {
        return Ok(normalized);
    }

    registrar.register_with_handler(&normalized)?;

    if current_shortcut != normalized && registrar.is_registered(current_shortcut) {
        let _ = registrar.unregister(current_shortcut);
    }

    Ok(normalized)
}

pub fn ensure_default_capture_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    state: &CaptureShortcutState,
) -> Result<(), String> {
    let current = state.get();
    let registrar = AppShortcutRegistrar::new(app);

    if registrar.is_registered(&current) {
        return Ok(());
    }

    registrar.register_with_handler(&current)
}

pub fn handle_shortcut_event<R: Runtime>(
    app: &AppHandle<R>,
    shortcut: &Shortcut,
    event: ShortcutEvent,
) {
    if event.state != ShortcutKeyState::Pressed {
        return;
    }

    let payload = ShortcutTriggeredPayload {
        shortcut: shortcut.into_string(),
    };

    if let Err(error) = app.emit(CAPTURE_SHORTCUT_EVENT, payload) {
        log::error!("Failed to emit shortcut event: {error}");
    }
}

#[tauri::command]
pub fn get_capture_shortcut(state: State<'_, CaptureShortcutState>) -> String {
    state.get()
}

#[tauri::command]
pub fn register_capture_shortcut<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, CaptureShortcutState>,
    shortcut: String,
) -> Result<String, String> {
    let current_shortcut = state.get();
    let registrar = AppShortcutRegistrar::new(&app);
    let next = update_registered_shortcut(&registrar, &current_shortcut, &shortcut)?;
    state.set(next.clone());
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MockShortcutRegistrar {
        registered: Mutex<HashSet<String>>,
        fail_register: Mutex<Option<String>>,
    }

    impl ShortcutRegistrar for MockShortcutRegistrar {
        fn is_registered(&self, shortcut: &str) -> bool {
            self.registered.lock().unwrap().contains(shortcut)
        }

        fn register_with_handler(&self, shortcut: &str) -> Result<(), String> {
            if let Some(error) = self.fail_register.lock().unwrap().clone() {
                return Err(error);
            }
            self.registered.lock().unwrap().insert(shortcut.to_string());
            Ok(())
        }

        fn unregister(&self, shortcut: &str) -> Result<(), String> {
            self.registered.lock().unwrap().remove(shortcut);
            Ok(())
        }
    }

    #[test]
    fn keeps_current_shortcut_if_already_registered() {
        let registrar = MockShortcutRegistrar::default();
        registrar
            .registered
            .lock()
            .unwrap()
            .insert(DEFAULT_CAPTURE_SHORTCUT.to_string());

        let updated = update_registered_shortcut(
            &registrar,
            DEFAULT_CAPTURE_SHORTCUT,
            DEFAULT_CAPTURE_SHORTCUT,
        )
        .expect("shortcut update should pass");

        assert_eq!(updated, DEFAULT_CAPTURE_SHORTCUT);
        assert!(registrar.is_registered(DEFAULT_CAPTURE_SHORTCUT));
    }

    #[test]
    fn updates_shortcut_and_unregisters_previous_shortcut() {
        let registrar = MockShortcutRegistrar::default();
        registrar
            .registered
            .lock()
            .unwrap()
            .insert(DEFAULT_CAPTURE_SHORTCUT.to_string());

        let updated = update_registered_shortcut(
            &registrar,
            DEFAULT_CAPTURE_SHORTCUT,
            "CommandOrControl+Shift+Y",
        )
        .expect("shortcut update should pass");

        assert_eq!(updated, "CommandOrControl+Shift+Y");
        assert!(!registrar.is_registered(DEFAULT_CAPTURE_SHORTCUT));
        assert!(registrar.is_registered("CommandOrControl+Shift+Y"));
    }

    #[test]
    fn propagates_registration_conflict_errors() {
        let registrar = MockShortcutRegistrar::default();
        *registrar.fail_register.lock().unwrap() =
            Some("already registered by another app".to_string());

        let error = update_registered_shortcut(
            &registrar,
            DEFAULT_CAPTURE_SHORTCUT,
            "CommandOrControl+Shift+Z",
        )
        .expect_err("shortcut update should fail");

        assert_eq!(error, "already registered by another app");
    }

    #[test]
    fn validates_shortcut_format() {
        let registrar = MockShortcutRegistrar::default();
        let error = update_registered_shortcut(&registrar, DEFAULT_CAPTURE_SHORTCUT, " ")
            .expect_err("empty shortcut should fail");

        assert_eq!(error, "Shortcut cannot be empty");
    }
}
