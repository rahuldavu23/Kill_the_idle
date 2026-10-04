// The desktop shell around the app.
//
// The window itself is frameless, so the titlebar is drawn by the web side;
// everything that cannot be done from there lives here: the tray icon, the
// always-on-top and launch-at-login switches, and the rule that closing the
// window ends the app rather than leaving it running unseen.
//
// Closing is a real quit: nothing is left in the background, and the app is
// started again from its own icon. That is safe because the day is written
// to storage as it is edited, never on the way out, so there is nothing
// waiting to be saved when the process ends.

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

const MAIN: &str = "main";

fn reveal(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.show();
        // Hidden and minimised are different states, and a window can be in
        // both — showing alone would leave it on the taskbar.
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show Present Flow", true, None::<&str>)?;
            let on_top = CheckMenuItem::with_id(app, "top", "Always on top", true, false, None::<&str>)?;
            // Reflects what the system actually has registered, not a guess,
            // so the tick is right on every launch.
            let at_login = CheckMenuItem::with_id(
                app,
                "login",
                "Launch at login",
                true,
                app.autolaunch().is_enabled().unwrap_or(false),
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&show, &on_top, &at_login, &PredefinedMenuItem::separator(app)?, &quit],
            )?;

            // A check item toggles itself before the event arrives, so its
            // state after the click is the state the user just asked for.
            let top_item = on_top.clone();
            let login_item = at_login.clone();

            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().expect("bundled window icon").clone())
                .tooltip("Present Flow")
                // Left click is the show/hide toggle, so the menu is on right.
                .show_menu_on_left_click(false)
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => reveal(app),
                    "top" => {
                        if let Some(window) = app.get_webview_window(MAIN) {
                            let _ = window.set_always_on_top(top_item.is_checked().unwrap_or(false));
                        }
                    }
                    "login" => {
                        let manager = app.autolaunch();
                        let _ = if login_item.is_checked().unwrap_or(false) {
                            manager.enable()
                        } else {
                            manager.disable()
                        };
                    }
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
                        let app = tray.app_handle();
                        let visible = app
                            .get_webview_window(MAIN)
                            .and_then(|window| window.is_visible().ok())
                            .unwrap_or(false);
                        if visible {
                            if let Some(window) = app.get_webview_window(MAIN) {
                                let _ = window.hide();
                            }
                        } else {
                            reveal(app);
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window ends the app. Exiting explicitly rather than
            // letting the last window fall away keeps the behaviour the same
            // whether or not a tray icon is holding the app alive.
            if let WindowEvent::CloseRequested { .. } = event {
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to start Present Flow");
}
