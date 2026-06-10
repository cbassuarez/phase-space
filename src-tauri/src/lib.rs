use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_opener::OpenerExt;

const REPO_URL: &str = "https://github.com/cbassuarez/phase-space";
const RELEASES_URL: &str = "https://github.com/cbassuarez/phase-space/releases";
const SPONSOR_URL: &str = "https://github.com/sponsors/cbassuarez";

/// Native app menu. The "about" and "reload" items emit a `menu` event the
/// frontend acts on (about opens the in-app modal; reload refreshes the view);
/// the link items open URLs natively; everything else is a standard OS item
/// with its conventional shortcut.
fn build_menu<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = Submenu::with_items(
        handle,
        "phase-space",
        true,
        &[
            &MenuItem::with_id(handle, "about", "About phase-space", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::services(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::show_all(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;
    let edit = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;
    let view = Submenu::with_items(
        handle,
        "View",
        true,
        &[
            &MenuItem::with_id(handle, "reload", "Reload View", true, Some("CmdOrCtrl+R"))?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::fullscreen(handle, None)?,
        ],
    )?;
    let window = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::maximize(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;
    let help = Submenu::with_items(
        handle,
        "Help",
        true,
        &[
            &MenuItem::with_id(handle, "github", "phase-space on GitHub", true, None::<&str>)?,
            &MenuItem::with_id(handle, "releases", "Releases & Downloads", true, None::<&str>)?,
            &PredefinedMenuItem::separator(handle)?,
            &MenuItem::with_id(handle, "sponsor", "Sponsor phase-space", true, None::<&str>)?,
        ],
    )?;
    Menu::with_items(handle, &[&app_menu, &edit, &view, &window, &help])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .menu(|handle| build_menu(handle))
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            match id {
                // Handled by the frontend (modal / refresh).
                "about" | "reload" => {
                    let _ = app.emit("menu", id);
                }
                "github" => {
                    let _ = app.opener().open_url(REPO_URL, None::<&str>);
                }
                "releases" => {
                    let _ = app.opener().open_url(RELEASES_URL, None::<&str>);
                }
                "sponsor" => {
                    let _ = app.opener().open_url(SPONSOR_URL, None::<&str>);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running phase-space");
}
