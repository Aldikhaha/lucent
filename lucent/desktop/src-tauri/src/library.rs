//! File-system side of the library. Audio files are referenced in place: nothing is copied.
//! The webview reads tags through `read_range` (reusing the JS tag parsers) and streams audio
//! through the asset protocol, which only serves files registered here.

use serde::Serialize;
use std::collections::HashSet;
use std::ffi::OsStr;
use std::fs::{File, Metadata};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::ipc::Response;
use tauri::{AppHandle, Manager};
use walkdir::WalkDir;

/// Keep in sync with frontend/core/audioFormats.ts
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "aac", "flac", "wav", "ogg", "oga", "opus", "webm"];

/// Largest single read the tag parsers may request (embedded artwork can be several MB).
const MAX_READ: u64 = 64 * 1024 * 1024;

fn is_hidden(name: &OsStr) -> bool {
    name.to_str().map(|n| n.starts_with('.')).unwrap_or(false)
}

pub fn is_audio(path: &Path) -> bool {
    match (path.file_name(), path.extension().and_then(|e| e.to_str())) {
        (Some(name), Some(ext)) => !is_hidden(name) && AUDIO_EXTENSIONS.iter().any(|a| a.eq_ignore_ascii_case(ext)),
        _ => false,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    path: String,
    name: String,
    /// "Album/Disc 1" style, relative to the parent of the picked/dropped folder ("" for loose files)
    folder: String,
    size: u64,
    /// ms since epoch
    modified: u64,
}

fn slash_path(p: &Path) -> String {
    p.components()
        .filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn modified_ms(meta: &Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn to_scanned(path: &Path, meta: &Metadata, folder: String) -> ScannedFile {
    ScannedFile {
        path: path.to_string_lossy().into_owned(),
        name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        folder,
        size: meta.len(),
        modified: modified_ms(meta),
    }
}

fn scan(paths: &[String]) -> Vec<ScannedFile> {
    let mut out = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();
    for raw in paths {
        let root = PathBuf::from(raw);
        let Ok(meta) = std::fs::metadata(&root) else { continue };
        if meta.is_file() {
            if is_audio(&root) && seen.insert(root.clone()) {
                out.push(to_scanned(&root, &meta, String::new()));
            }
            continue;
        }
        // Relative to the folder's parent so paths start with the folder's own name,
        // matching the browser prototype's webkitRelativePath.
        let base = root.parent().map(Path::to_path_buf).unwrap_or_else(|| root.clone());
        let walker = WalkDir::new(&root)
            .follow_links(true)
            .sort_by_file_name()
            .into_iter()
            .filter_entry(|e| e.depth() == 0 || !is_hidden(e.file_name()));
        for entry in walker.filter_map(Result::ok) {
            if !entry.file_type().is_file() || !is_audio(entry.path()) {
                continue;
            }
            let Ok(meta) = entry.metadata() else { continue };
            let path = entry.path().to_path_buf();
            if !seen.insert(path.clone()) {
                continue;
            }
            let folder = path
                .parent()
                .and_then(|p| p.strip_prefix(&base).ok())
                .map(slash_path)
                .unwrap_or_default();
            out.push(to_scanned(&path, &meta, folder));
        }
    }
    out
}

/// Recursively lists audio files under the given files/folders and allows the webview to stream them.
#[tauri::command]
pub async fn scan_paths(app: AppHandle, paths: Vec<String>) -> Result<Vec<ScannedFile>, String> {
    let files = tauri::async_runtime::spawn_blocking(move || scan(&paths))
        .await
        .map_err(|e| e.to_string())?;
    let scope = app.asset_protocol_scope();
    for f in &files {
        let _ = scope.allow_file(&f.path);
    }
    Ok(files)
}

/// Reads a byte range of an audio file (used by the JS tag parsers). Returned as raw bytes.
#[tauri::command]
pub async fn read_range(path: String, start: u64, length: u64) -> Result<Response, String> {
    let file_path = PathBuf::from(path);
    if !is_audio(&file_path) {
        return Err("Only audio files can be read".into());
    }
    let bytes = tauri::async_runtime::spawn_blocking(move || -> std::io::Result<Vec<u8>> {
        let mut file = File::open(&file_path)?;
        let size = file.metadata()?.len();
        if start >= size {
            return Ok(Vec::new());
        }
        let len = length.min(size - start).min(MAX_READ) as usize;
        file.seek(SeekFrom::Start(start))?;
        let mut buf = vec![0u8; len];
        file.read_exact(&mut buf)?;
        Ok(buf)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    Ok(Response::new(bytes))
}

/// Allows streaming of library files that still exist and returns the paths that are missing.
#[tauri::command]
pub async fn register_library_files(app: AppHandle, paths: Vec<String>) -> Result<Vec<String>, String> {
    let (present, missing) = tauri::async_runtime::spawn_blocking(move || {
        let mut present: Vec<PathBuf> = Vec::new();
        let mut missing: Vec<String> = Vec::new();
        for p in paths {
            let pb = PathBuf::from(&p);
            if !is_audio(&pb) {
                continue;
            }
            if pb.is_file() {
                present.push(pb);
            } else {
                missing.push(p);
            }
        }
        (present, missing)
    })
    .await
    .map_err(|e| e.to_string())?;
    let scope = app.asset_protocol_scope();
    for p in &present {
        let _ = scope.allow_file(p);
    }
    Ok(missing)
}

/// Audio files or folders passed on the command line (Explorer "Open with", file associations).
pub fn launch_args(argv: &[String]) -> Vec<String> {
    argv.iter()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .filter(|a| {
            let p = Path::new(a.as_str());
            p.is_dir() || (p.is_file() && is_audio(p))
        })
        .cloned()
        .collect()
}
