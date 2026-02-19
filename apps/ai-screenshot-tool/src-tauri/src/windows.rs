use serde::Serialize;
use xcap::Window;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub id: u32,
    pub monitor_id: Option<u32>,
    pub app_name: String,
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub z: i32,
    pub is_focused: bool,
}

pub trait WindowProvider {
    fn list_windows(&self) -> Result<Vec<WindowInfo>, String>;
}

pub struct XcapWindowProvider;

impl WindowProvider for XcapWindowProvider {
    fn list_windows(&self) -> Result<Vec<WindowInfo>, String> {
        let windows =
            Window::all().map_err(|error| format!("Unable to enumerate windows: {error}"))?;
        let mut items = Vec::with_capacity(windows.len());

        for window in windows {
            let id = window
                .id()
                .map_err(|error| format!("Unable to read window id: {error}"))?;
            let monitor_id = window
                .current_monitor()
                .ok()
                .and_then(|monitor| monitor.id().ok());
            let app_name = window
                .app_name()
                .map_err(|error| format!("Unable to read window app_name: {error}"))?;
            let title = window.title().unwrap_or_default();
            let x = window
                .x()
                .map_err(|error| format!("Unable to read window x: {error}"))?;
            let y = window
                .y()
                .map_err(|error| format!("Unable to read window y: {error}"))?;
            let width = window
                .width()
                .map_err(|error| format!("Unable to read window width: {error}"))?;
            let height = window
                .height()
                .map_err(|error| format!("Unable to read window height: {error}"))?;
            let z = window
                .z()
                .map_err(|error| format!("Unable to read window z: {error}"))?;
            let is_focused = window.is_focused().unwrap_or(false);

            items.push(WindowInfo {
                id,
                monitor_id,
                app_name,
                title,
                x,
                y,
                width,
                height,
                z,
                is_focused,
            });
        }

        Ok(items)
    }
}

pub fn get_windows_with_provider<P: WindowProvider>(
    provider: &P,
) -> Result<Vec<WindowInfo>, String> {
    provider.list_windows()
}

#[tauri::command]
pub fn get_windows() -> Result<Vec<WindowInfo>, String> {
    get_windows_with_provider(&XcapWindowProvider)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockWindowProvider {
        result: Result<Vec<WindowInfo>, String>,
    }

    impl WindowProvider for MockWindowProvider {
        fn list_windows(&self) -> Result<Vec<WindowInfo>, String> {
            self.result.clone()
        }
    }

    #[test]
    fn returns_window_list_from_provider() {
        let provider = MockWindowProvider {
            result: Ok(vec![WindowInfo {
                id: 10,
                monitor_id: Some(1),
                app_name: "Focus&Go".to_string(),
                title: "Dashboard".to_string(),
                x: 120,
                y: 40,
                width: 1280,
                height: 720,
                z: 1,
                is_focused: true,
            }]),
        };

        let windows = get_windows_with_provider(&provider).expect("window list should pass");
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].id, 10);
        assert!(windows[0].is_focused);
    }

    #[test]
    fn propagates_window_provider_errors() {
        let provider = MockWindowProvider {
            result: Err("mock-window-failure".to_string()),
        };

        let error = get_windows_with_provider(&provider).expect_err("window list should fail");
        assert_eq!(error, "mock-window-failure");
    }
}
