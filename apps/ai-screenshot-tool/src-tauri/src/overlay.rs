use mouse_position::mouse_position::Mouse;
use serde::Serialize;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size};
use xcap::Monitor;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MonitorBounds {
    pub monitor_id: Option<u32>,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

pub trait MonitorProvider {
    fn list_monitors(&self) -> Result<Vec<MonitorBounds>, String>;
}

pub struct XcapMonitorProvider;

impl MonitorProvider for XcapMonitorProvider {
    fn list_monitors(&self) -> Result<Vec<MonitorBounds>, String> {
        let monitors =
            Monitor::all().map_err(|error| format!("Unable to enumerate monitors: {error}"))?;
        let mut bounds = Vec::with_capacity(monitors.len());

        for monitor in monitors {
            bounds.push(MonitorBounds {
                monitor_id: monitor.id().ok(),
                x: monitor.x().unwrap_or(0),
                y: monitor.y().unwrap_or(0),
                width: monitor.width().unwrap_or(0),
                height: monitor.height().unwrap_or(0),
                is_primary: monitor.is_primary().unwrap_or(false),
            });
        }

        Ok(bounds)
    }
}

pub trait CursorPositionProvider {
    fn get_position(&self) -> Result<(i32, i32), String>;
}

pub struct SystemCursorPositionProvider;

impl CursorPositionProvider for SystemCursorPositionProvider {
    fn get_position(&self) -> Result<(i32, i32), String> {
        match Mouse::get_mouse_position() {
            Mouse::Position { x, y } => Ok((x, y)),
            Mouse::Error => Err("Unable to read mouse position".to_string()),
        }
    }
}

pub fn resolve_monitor_bounds_with_provider<P: MonitorProvider>(
    provider: &P,
    monitor_id: Option<u32>,
) -> Result<MonitorBounds, String> {
    let monitors = provider.list_monitors()?;
    if monitors.is_empty() {
        return Err("No monitor detected".to_string());
    }

    if let Some(target_id) = monitor_id {
        return monitors
            .into_iter()
            .find(|item| item.monitor_id == Some(target_id))
            .ok_or_else(|| format!("Monitor {target_id} was not found"));
    }

    Ok(monitors
        .iter()
        .find(|item| item.is_primary)
        .cloned()
        .unwrap_or_else(|| monitors[0].clone()))
}

fn is_point_inside_monitor(monitor: &MonitorBounds, x: i32, y: i32) -> bool {
    let right = monitor.x.saturating_add(monitor.width as i32);
    let bottom = monitor.y.saturating_add(monitor.height as i32);

    x >= monitor.x && x < right && y >= monitor.y && y < bottom
}

pub fn resolve_monitor_at_point(
    monitors: &[MonitorBounds],
    x: i32,
    y: i32,
) -> Option<MonitorBounds> {
    monitors
        .iter()
        .find(|monitor| is_point_inside_monitor(monitor, x, y))
        .cloned()
}

pub fn resolve_cursor_monitor_with_provider<P: MonitorProvider, C: CursorPositionProvider>(
    monitor_provider: &P,
    cursor_provider: &C,
) -> Result<MonitorBounds, String> {
    let monitors = monitor_provider.list_monitors()?;
    if monitors.is_empty() {
        return Err("No monitor detected".to_string());
    }

    let (cursor_x, cursor_y) = cursor_provider.get_position()?;
    if let Some(bounds) = resolve_monitor_at_point(&monitors, cursor_x, cursor_y) {
        return Ok(bounds);
    }

    Ok(monitors
        .iter()
        .find(|item| item.is_primary)
        .cloned()
        .unwrap_or_else(|| monitors[0].clone()))
}

fn apply_overlay_window(app: &AppHandle, bounds: &MonitorBounds) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window was not found".to_string())?;

    window
        .set_decorations(false)
        .map_err(|error| format!("Failed to set window decorations: {error}"))?;
    window
        .set_resizable(false)
        .map_err(|error| format!("Failed to set window resizable: {error}"))?;
    window
        .set_always_on_top(true)
        .map_err(|error| format!("Failed to set window always-on-top: {error}"))?;
    window
        .set_skip_taskbar(true)
        .map_err(|error| format!("Failed to set window skip-taskbar: {error}"))?;

    window
        .set_position(Position::Physical(PhysicalPosition::new(
            bounds.x, bounds.y,
        )))
        .map_err(|error| format!("Failed to set window position: {error}"))?;
    window
        .set_size(Size::Physical(PhysicalSize::new(
            bounds.width,
            bounds.height,
        )))
        .map_err(|error| format!("Failed to set window size: {error}"))?;

    window
        .show()
        .map_err(|error| format!("Failed to show overlay window: {error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("Failed to focus overlay window: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn get_monitors() -> Result<Vec<MonitorBounds>, String> {
    XcapMonitorProvider.list_monitors()
}

#[tauri::command]
pub fn get_monitor_at_cursor() -> Result<MonitorBounds, String> {
    resolve_cursor_monitor_with_provider(&XcapMonitorProvider, &SystemCursorPositionProvider)
}

#[tauri::command]
pub fn show_overlay(app: AppHandle, monitor_id: Option<u32>) -> Result<MonitorBounds, String> {
    let bounds = resolve_monitor_bounds_with_provider(&XcapMonitorProvider, monitor_id)?;
    apply_overlay_window(&app, &bounds)?;
    Ok(bounds)
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window was not found".to_string())?;

    window
        .set_skip_taskbar(false)
        .map_err(|error| format!("Failed to reset skip-taskbar: {error}"))?;
    window
        .set_always_on_top(false)
        .map_err(|error| format!("Failed to reset always-on-top: {error}"))?;
    window
        .set_resizable(true)
        .map_err(|error| format!("Failed to reset resizable: {error}"))?;
    window
        .set_decorations(true)
        .map_err(|error| format!("Failed to reset decorations: {error}"))?;
    window
        .hide()
        .map_err(|error| format!("Failed to hide overlay window: {error}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockMonitorProvider {
        result: Result<Vec<MonitorBounds>, String>,
    }

    impl MonitorProvider for MockMonitorProvider {
        fn list_monitors(&self) -> Result<Vec<MonitorBounds>, String> {
            self.result.clone()
        }
    }

    struct MockCursorPositionProvider {
        result: Result<(i32, i32), String>,
    }

    impl CursorPositionProvider for MockCursorPositionProvider {
        fn get_position(&self) -> Result<(i32, i32), String> {
            self.result.clone()
        }
    }

    #[test]
    fn returns_primary_monitor_by_default() {
        let provider = MockMonitorProvider {
            result: Ok(vec![
                MonitorBounds {
                    monitor_id: Some(1),
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080,
                    is_primary: true,
                },
                MonitorBounds {
                    monitor_id: Some(2),
                    x: 1920,
                    y: 0,
                    width: 1920,
                    height: 1080,
                    is_primary: false,
                },
            ]),
        };

        let bounds = resolve_monitor_bounds_with_provider(&provider, None)
            .expect("monitor resolution should pass");
        assert_eq!(bounds.monitor_id, Some(1));
    }

    #[test]
    fn returns_selected_monitor_when_id_is_specified() {
        let provider = MockMonitorProvider {
            result: Ok(vec![MonitorBounds {
                monitor_id: Some(2),
                x: 1920,
                y: 0,
                width: 1920,
                height: 1080,
                is_primary: false,
            }]),
        };

        let bounds = resolve_monitor_bounds_with_provider(&provider, Some(2))
            .expect("monitor resolution should pass");
        assert_eq!(bounds.monitor_id, Some(2));
    }

    #[test]
    fn fails_when_monitor_is_missing() {
        let provider = MockMonitorProvider { result: Ok(vec![]) };

        let error = resolve_monitor_bounds_with_provider(&provider, None)
            .expect_err("resolution should fail");
        assert_eq!(error, "No monitor detected");
    }

    #[test]
    fn resolves_monitor_from_cursor_point() {
        let monitor_provider = MockMonitorProvider {
            result: Ok(vec![
                MonitorBounds {
                    monitor_id: Some(1),
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080,
                    is_primary: true,
                },
                MonitorBounds {
                    monitor_id: Some(2),
                    x: 1920,
                    y: 0,
                    width: 1920,
                    height: 1080,
                    is_primary: false,
                },
            ]),
        };
        let cursor_provider = MockCursorPositionProvider {
            result: Ok((2300, 140)),
        };

        let bounds = resolve_cursor_monitor_with_provider(&monitor_provider, &cursor_provider)
            .expect("cursor monitor resolution should pass");
        assert_eq!(bounds.monitor_id, Some(2));
    }

    #[test]
    fn falls_back_to_primary_when_cursor_is_outside_monitor_range() {
        let monitor_provider = MockMonitorProvider {
            result: Ok(vec![
                MonitorBounds {
                    monitor_id: Some(1),
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080,
                    is_primary: true,
                },
                MonitorBounds {
                    monitor_id: Some(2),
                    x: 1920,
                    y: 0,
                    width: 1920,
                    height: 1080,
                    is_primary: false,
                },
            ]),
        };
        let cursor_provider = MockCursorPositionProvider {
            result: Ok((9999, 9999)),
        };

        let bounds = resolve_cursor_monitor_with_provider(&monitor_provider, &cursor_provider)
            .expect("cursor monitor resolution should pass");
        assert_eq!(bounds.monitor_id, Some(1));
    }
}
