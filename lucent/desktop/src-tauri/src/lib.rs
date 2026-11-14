mod library;
mod tray;

use std::sync::Mutex;
use tauri::Emitter;
use tauri_plugin_window_state::StateFlags;

/// Files passed on the command line when Lucent was launched; handed to the webview once.
struct LaunchFiles(Mutex<Option<Vec<String>>>);

#[tauri::command]
fn take_launch_files(state: tauri::State<'_, LaunchFiles>) -> Vec<String> {
    state
        .0
        .lock()
        .map(|mut files| files.take().unwrap_or_default())
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let argv: Vec<String> = std::env::args().collect();

    tauri::Builder::default()
        // Must be first: a second launch (e.g. double-clicking a song) focuses this window instead.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let files = library::launch_args(&argv);
            if !files.is_empty() {
                let _ = app.emit("lucent:open-files", files);
            }
            tray::show_main(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(LaunchFiles(Mutex::new(Some(library::launch_args(&argv)))))
        .invoke_handler(tauri::generate_handler![
            library::scan_paths,
            library::read_range,
            library::register_library_files,
            take_launch_files,
            tray::set_tray_tooltip,
        ])
        .setup(|app| {
            tray::create(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Lucent");
}
