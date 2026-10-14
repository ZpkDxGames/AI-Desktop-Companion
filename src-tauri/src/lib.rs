//! Native shell. AI access is constrained to explicit local Ollama commands.
mod ollama;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri::menu::MenuBuilder;
use tauri::tray::TrayIconBuilder;

struct Passthrough(Mutex<bool>);

fn update_passthrough(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let window = app.get_webview_window("avatar").ok_or("Avatar window missing")?;
    window.set_ignore_cursor_events(enabled).map_err(|e| e.to_string())?;
    *app.state::<Passthrough>().0.lock().map_err(|_| "State lock poisoned")? = enabled;
    let _ = app.emit("zpkdx:passthrough", enabled);
    Ok(())
}

#[tauri::command]
fn set_passthrough(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    update_passthrough(&app, enabled)
}

#[tauri::command]
fn begin_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "avatar" { return Err("Drag is restricted to the avatar window".into()); }
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_workshop(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("workshop").ok_or("Workshop window missing")?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(Passthrough(Mutex::new(false)))
        .manage(ollama::PendingRequests::default())
        .invoke_handler(tauri::generate_handler![set_passthrough, begin_drag, open_workshop, ollama::ollama_list_models, ollama::ollama_chat, ollama::ollama_cancel])
        .setup(|app| {
            let menu = MenuBuilder::new(app)
                .text("workshop", "Open animation workshop")
                .text("passthrough", "Toggle avatar click-through")
                .text("wave", "Wave")
                .separator()
                .text("quit", "Quit ZpkDxGames")
                .build()?;
            let icon = app.default_window_icon().expect("Tauri bundle must include an icon").clone();
            TrayIconBuilder::new()
                .icon(icon)
                .tooltip("ZpkDxGames Desktop Companion — local preview")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "workshop" => {
                        if let Some(window) = app.get_webview_window("workshop") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "passthrough" => {
                        let enabled = app.state::<Passthrough>().0.lock().map(|v| !*v).unwrap_or(false);
                        let _ = update_passthrough(app, enabled);
                    }
                    "wave" => { let _ = app.emit("zpkdx:wave", ()); }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "workshop" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to start ZpkDxGames Desktop Companion");
}
