use std::collections::HashSet;
use std::sync::Mutex;
use tauri::{Manager, State};

#[derive(Default)]
pub struct ChildProcessTracker(pub Mutex<HashSet<u32>>);

#[tauri::command]
fn register_child_pid(state: State<'_, ChildProcessTracker>, pid: u32) {
  if let Ok(mut pids) = state.0.lock() {
    pids.insert(pid);
    log::info!("Child process PID {} registered with tracker", pid);
  }
}

#[tauri::command]
fn unregister_child_pid(state: State<'_, ChildProcessTracker>, pid: u32) {
  if let Ok(mut pids) = state.0.lock() {
    pids.remove(&pid);
    log::info!("Child process PID {} unregistered from tracker", pid);
  }
}

fn terminate_child_process_tree(pid: u32) {
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    log::info!("Terminating process tree for PID {}", pid);
    let _ = std::process::Command::new("taskkill")
      .args(["/F", "/T", "/PID", &pid.to_string()])
      .creation_flags(CREATE_NO_WINDOW)
      .status();
  }
  #[cfg(not(target_os = "windows"))]
  {
    log::info!("Terminating process for PID {}", pid);
    let _ = std::process::Command::new("kill")
      .args(["-9", &pid.to_string()])
      .status();
  }
}

#[tauri::command]
fn kill_child_process_tree_command(state: State<'_, ChildProcessTracker>, pid: u32) {
  if let Ok(mut pids) = state.0.lock() {
    pids.remove(&pid);
  }
  terminate_child_process_tree(pid);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ChildProcessTracker::default())
    .invoke_handler(tauri::generate_handler![
      register_child_pid,
      unregister_child_pid,
      kill_child_process_tree_command
    ])
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_persisted_scope::init())
    .setup(|app| {
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| {
      if let tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. } = event {
        if let Some(state) = app_handle.try_state::<ChildProcessTracker>() {
          if let Ok(mut pids) = state.0.lock() {
            // Mengambil semua PID terdaftar sekaligus dan mengosongkan state (drain)
            // sehingga jika ExitRequested kemudian disusul Exit, tidak ada pemanggilan ganda.
            let pids_to_kill: Vec<u32> = pids.drain().collect();
            for pid in pids_to_kill {
              terminate_child_process_tree(pid);
            }
          }
        }
      }
    });
}
