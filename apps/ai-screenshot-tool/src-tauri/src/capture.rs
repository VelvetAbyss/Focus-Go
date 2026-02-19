use image::{ImageBuffer, Rgba};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;
use xcap::Monitor;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapturePayload {
    pub capture_id: String,
    pub monitor_id: Option<u32>,
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub width: u32,
    pub height: u32,
    pub pixel_format: String,
    pub transfer_mode: String,
    pub image_path: String,
    pub bytes_len: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RawCaptureFrame {
    pub monitor_id: Option<u32>,
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub width: u32,
    pub height: u32,
    pub pixel_format: String,
    pub bytes: Vec<u8>,
}

pub trait ScreenCaptureProvider {
    fn capture_monitor(&self, monitor_id: Option<u32>) -> Result<RawCaptureFrame, String>;
}

pub struct XcapScreenCaptureProvider;

impl XcapScreenCaptureProvider {
    fn select_monitor(monitors: &[Monitor], monitor_id: Option<u32>) -> Result<Monitor, String> {
        if monitors.is_empty() {
            return Err("No monitor detected".to_string());
        }

        if let Some(target_id) = monitor_id {
            return monitors
                .iter()
                .find(|monitor| monitor.id().is_ok_and(|id| id == target_id))
                .cloned()
                .ok_or_else(|| format!("Monitor {target_id} was not found"));
        }

        Ok(monitors
            .iter()
            .find(|monitor| monitor.is_primary().unwrap_or(false))
            .cloned()
            .unwrap_or_else(|| monitors[0].clone()))
    }
}

impl ScreenCaptureProvider for XcapScreenCaptureProvider {
    fn capture_monitor(&self, monitor_id: Option<u32>) -> Result<RawCaptureFrame, String> {
        let monitors =
            Monitor::all().map_err(|error| format!("Unable to enumerate monitors: {error}"))?;
        let selected_monitor = Self::select_monitor(&monitors, monitor_id)?;

        let selected_monitor_id = selected_monitor.id().ok();
        let monitor_x = selected_monitor.x().unwrap_or(0);
        let monitor_y = selected_monitor.y().unwrap_or(0);
        let image = selected_monitor
            .capture_image()
            .map_err(|error| format!("Failed to capture screen: {error}"))?;

        Ok(RawCaptureFrame {
            monitor_id: selected_monitor_id,
            monitor_x,
            monitor_y,
            width: image.width(),
            height: image.height(),
            pixel_format: "rgba8".to_string(),
            bytes: image.into_raw(),
        })
    }
}

fn create_capture_dir(base_dir: &Path) -> Result<PathBuf, String> {
    let path = base_dir
        .join("focus-go-ai-screenshot-tool")
        .join("captures");
    fs::create_dir_all(&path)
        .map_err(|error| format!("Failed to create capture directory: {error}"))?;
    Ok(path)
}

fn persist_capture_frame(
    base_dir: &Path,
    frame: RawCaptureFrame,
) -> Result<CapturePayload, String> {
    let capture_id = Uuid::new_v4().to_string();
    let capture_dir = create_capture_dir(base_dir)?;
    let image_path = capture_dir.join(format!("{capture_id}.png"));
    let bytes_len = frame.bytes.len();

    let image = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(frame.width, frame.height, frame.bytes)
        .ok_or_else(|| "Failed to decode RGBA buffer".to_string())?;
    image
        .save(&image_path)
        .map_err(|error| format!("Failed to persist capture image: {error}"))?;

    Ok(CapturePayload {
        capture_id,
        monitor_id: frame.monitor_id,
        monitor_x: frame.monitor_x,
        monitor_y: frame.monitor_y,
        width: frame.width,
        height: frame.height,
        pixel_format: frame.pixel_format,
        transfer_mode: "file-backed".to_string(),
        image_path: image_path.to_string_lossy().to_string(),
        bytes_len,
    })
}

pub fn capture_screen_with_provider<P: ScreenCaptureProvider>(
    provider: &P,
    monitor_id: Option<u32>,
    base_dir: &Path,
) -> Result<CapturePayload, String> {
    let frame = provider.capture_monitor(monitor_id)?;
    persist_capture_frame(base_dir, frame)
}

#[tauri::command]
pub fn capture_screen(monitor_id: Option<u32>) -> Result<CapturePayload, String> {
    capture_screen_with_provider(
        &XcapScreenCaptureProvider,
        monitor_id,
        &std::env::temp_dir(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockScreenCaptureProvider {
        result: Result<RawCaptureFrame, String>,
    }

    impl ScreenCaptureProvider for MockScreenCaptureProvider {
        fn capture_monitor(&self, _monitor_id: Option<u32>) -> Result<RawCaptureFrame, String> {
            self.result.clone()
        }
    }

    #[test]
    fn returns_capture_payload_and_writes_png() {
        let provider = MockScreenCaptureProvider {
            result: Ok(RawCaptureFrame {
                monitor_id: Some(1),
                monitor_x: 0,
                monitor_y: 0,
                width: 2,
                height: 2,
                pixel_format: "rgba8".to_string(),
                bytes: vec![
                    255, 0, 0, 255, //
                    0, 255, 0, 255, //
                    0, 0, 255, 255, //
                    255, 255, 255, 255,
                ],
            }),
        };

        let base_dir = std::env::temp_dir().join(format!("focus-go-test-{}", Uuid::new_v4()));
        let payload = capture_screen_with_provider(&provider, Some(1), &base_dir)
            .expect("capture should pass");

        assert_eq!(payload.monitor_id, Some(1));
        assert_eq!(payload.width, 2);
        assert_eq!(payload.height, 2);
        assert_eq!(payload.transfer_mode, "file-backed");
        assert_eq!(payload.bytes_len, 16);
        assert!(Path::new(&payload.image_path).exists());

        let _ = fs::remove_file(&payload.image_path);
        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn propagates_provider_errors() {
        let provider = MockScreenCaptureProvider {
            result: Err("mock-capture-failure".to_string()),
        };

        let base_dir = std::env::temp_dir().join(format!("focus-go-test-{}", Uuid::new_v4()));
        let error = capture_screen_with_provider(&provider, Some(99), &base_dir)
            .expect_err("capture should fail");

        assert_eq!(error, "mock-capture-failure");
    }
}
