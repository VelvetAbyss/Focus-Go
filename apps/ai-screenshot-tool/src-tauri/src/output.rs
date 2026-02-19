use chrono::{DateTime, Local};
use image::imageops;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{image::Image, AppHandle, Manager, Runtime, State};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;

const OUTPUT_SETTINGS_FILE: &str = "ai-screenshot-output.json";

#[derive(Default)]
pub struct OutputDirectoryState {
    directory: Mutex<Option<PathBuf>>,
}

impl OutputDirectoryState {
    pub fn new(directory: Option<PathBuf>) -> Self {
        Self {
            directory: Mutex::new(directory),
        }
    }

    pub fn get(&self) -> Option<PathBuf> {
        self.directory.lock().unwrap().clone()
    }

    pub fn set(&self, directory: Option<PathBuf>) {
        *self.directory.lock().unwrap() = directory;
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutputSettingsFile {
    save_directory: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionRectInput {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteCaptureOutputRequest {
    pub capture_id: String,
    pub image_path: String,
    pub selection: SelectionRectInput,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteCaptureOutputResult {
    pub capture_id: String,
    pub saved_path: String,
    pub file_name: String,
    pub output_directory: String,
    pub copied_to_clipboard: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CropBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

fn app_settings_file_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Failed to resolve app config directory: {error}"))?;
    fs::create_dir_all(&config_dir)
        .map_err(|error| format!("Failed to create app config directory: {error}"))?;

    Ok(config_dir.join(OUTPUT_SETTINGS_FILE))
}

fn save_output_directory_setting<R: Runtime>(
    app: &AppHandle<R>,
    directory: &Path,
) -> Result<(), String> {
    let path = app_settings_file_path(app)?;
    let payload = OutputSettingsFile {
        save_directory: Some(directory.to_string_lossy().to_string()),
    };
    let json = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Failed to serialize output settings: {error}"))?;

    fs::write(path, json).map_err(|error| format!("Failed to persist output settings: {error}"))?;
    Ok(())
}

pub fn load_output_directory<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let path = app_settings_file_path(app).ok()?;
    let text = fs::read_to_string(path).ok()?;
    let payload: OutputSettingsFile = serde_json::from_str(&text).ok()?;

    payload.save_directory.map(PathBuf::from)
}

fn resolve_output_directory<R: Runtime>(
    app: &AppHandle<R>,
    state: &OutputDirectoryState,
) -> Result<PathBuf, String> {
    if let Some(path) = state.get() {
        fs::create_dir_all(&path)
            .map_err(|error| format!("Failed to create output directory: {error}"))?;
        return Ok(path);
    }

    let selected = app
        .dialog()
        .file()
        .set_title("Select Focus&Go Screenshot Output Directory")
        .blocking_pick_folder()
        .ok_or_else(|| "Output folder selection cancelled".to_string())?;

    let path = selected
        .into_path()
        .map_err(|error| format!("Invalid output folder path: {error}"))?;

    fs::create_dir_all(&path)
        .map_err(|error| format!("Failed to create output directory: {error}"))?;
    state.set(Some(path.clone()));
    save_output_directory_setting(app, &path)?;
    Ok(path)
}

pub fn generate_output_file_name(now: DateTime<Local>) -> String {
    format!("focusgo-{}.png", now.format("%Y%m%d-%H%M%S"))
}

pub fn resolve_crop_bounds(
    image_width: u32,
    image_height: u32,
    selection: &SelectionRectInput,
) -> Result<CropBounds, String> {
    if selection.width <= 0.0 || selection.height <= 0.0 {
        return Err("Selection must have a non-zero width and height".to_string());
    }

    let x = selection.x.max(0.0).floor() as u32;
    let y = selection.y.max(0.0).floor() as u32;
    if x >= image_width || y >= image_height {
        return Err("Selection is outside the image bounds".to_string());
    }

    let width = selection.width.floor() as u32;
    let height = selection.height.floor() as u32;
    let clamped_width = width.min(image_width.saturating_sub(x));
    let clamped_height = height.min(image_height.saturating_sub(y));
    if clamped_width == 0 || clamped_height == 0 {
        return Err("Selection has no drawable area after clamping".to_string());
    }

    Ok(CropBounds {
        x,
        y,
        width: clamped_width,
        height: clamped_height,
    })
}

#[tauri::command]
pub fn get_output_directory(state: State<'_, OutputDirectoryState>) -> Option<String> {
    state.get().map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn complete_capture_output<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, OutputDirectoryState>,
    request: CompleteCaptureOutputRequest,
) -> Result<CompleteCaptureOutputResult, String> {
    let output_directory = resolve_output_directory(&app, state.inner())?;
    let source_image = image::open(&request.image_path)
        .map_err(|error| format!("Failed to open capture image: {error}"))?
        .to_rgba8();

    let crop = resolve_crop_bounds(
        source_image.width(),
        source_image.height(),
        &request.selection,
    )?;
    let cropped =
        imageops::crop_imm(&source_image, crop.x, crop.y, crop.width, crop.height).to_image();

    let file_name = generate_output_file_name(Local::now());
    let save_path = output_directory.join(&file_name);
    cropped
        .save(&save_path)
        .map_err(|error| format!("Failed to save cropped output: {error}"))?;

    let clipboard_image = Image::new_owned(cropped.into_raw(), crop.width, crop.height);
    app.clipboard()
        .write_image(&clipboard_image)
        .map_err(|error| format!("Failed to write image to clipboard: {error}"))?;

    Ok(CompleteCaptureOutputResult {
        capture_id: request.capture_id,
        saved_path: save_path.to_string_lossy().to_string(),
        file_name,
        output_directory: output_directory.to_string_lossy().to_string(),
        copied_to_clipboard: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_focusgo_file_name() {
        let date = DateTime::parse_from_rfc3339("2026-02-19T21:30:45+08:00")
            .unwrap()
            .with_timezone(&Local);

        let name = generate_output_file_name(date);
        assert!(name.starts_with("focusgo-"));
        assert!(name.ends_with(".png"));
    }

    #[test]
    fn resolves_crop_bounds_within_image() {
        let selection = SelectionRectInput {
            x: 10.0,
            y: 5.0,
            width: 120.0,
            height: 80.0,
        };

        let crop = resolve_crop_bounds(1920, 1080, &selection).expect("crop should pass");
        assert_eq!(
            crop,
            CropBounds {
                x: 10,
                y: 5,
                width: 120,
                height: 80
            }
        );
    }

    #[test]
    fn clamps_crop_bounds_to_image_dimensions() {
        let selection = SelectionRectInput {
            x: 1900.0,
            y: 1070.0,
            width: 200.0,
            height: 100.0,
        };

        let crop = resolve_crop_bounds(1920, 1080, &selection).expect("crop should pass");
        assert_eq!(
            crop,
            CropBounds {
                x: 1900,
                y: 1070,
                width: 20,
                height: 10
            }
        );
    }

    #[test]
    fn rejects_zero_size_selection() {
        let selection = SelectionRectInput {
            x: 100.0,
            y: 100.0,
            width: 0.0,
            height: 100.0,
        };

        let error = resolve_crop_bounds(1920, 1080, &selection).expect_err("crop should fail");
        assert_eq!(error, "Selection must have a non-zero width and height");
    }
}
