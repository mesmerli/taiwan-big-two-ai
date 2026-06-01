use tauri::Manager;

#[derive(serde::Serialize)]
pub struct LicenseStatus {
    pub is_active: bool,
    pub is_trial: bool,
    pub trial_days_remaining: i64,
}

#[tauri::command]
async fn check_windows_store_license(window: tauri::Window) -> Result<LicenseStatus, String> {
    // A. 如果是本地偵錯 (debug_assertions) 或沒有啟用 store feature (社群版)
    // 則直接回傳模擬授權
    if cfg!(debug_assertions) || !cfg!(feature = "store") {
        let _ = window;
        
        // 如果是商店偵錯版，模擬回傳試用期天數（便於測試）
        if cfg!(feature = "store") {
            println!("[Store] 偵測為商店偵錯模式，回傳模擬的試用期狀態 (剩餘 7 天)");
            return Ok(LicenseStatus {
                is_active: true,
                is_trial: true,
                trial_days_remaining: 7,
            });
        }
        
        // 如果是社群直裝版，直接給予已啟用的完整版狀態
        return Ok(LicenseStatus {
            is_active: true,
            is_trial: false,
            trial_days_remaining: 0,
        });
    }

    // B. 正式發佈且啟用 store feature 時，才呼叫微軟商店授權 API
    #[cfg(all(not(debug_assertions), feature = "store"))]
    {
        check_windows_store_license_impl(window)
    }

    // 在其他編譯分支下（主要是偵錯模式或社群版），回傳一個預設成功授權以滿足編譯器型別推導
    #[cfg(any(debug_assertions, not(feature = "store")))]
    {
        let _ = window;
        Ok(LicenseStatus {
            is_active: true,
            is_trial: false,
            trial_days_remaining: 0,
        })
    }
}

#[cfg(all(not(debug_assertions), feature = "store", target_os = "windows"))]
fn check_windows_store_license_impl(window: tauri::Window) -> Result<LicenseStatus, String> {
    use windows::Services::Store::StoreContext;
    use windows::Win32::UI::Shell::IInitializeWithWindow;
    use windows::core::Interface;

    // 取得 Tauri 視窗的 HWND 控制代碼
    let hwnd = window.hwnd()
        .map_err(|e| format!("無法取得視窗控制代碼 (HWND): {}", e))?;

    // 取得 Windows Store 的 StoreContext
    let context = StoreContext::GetDefault()
        .map_err(|e| format!("無法取得 StoreContext.GetDefault(): {}", e))?;

    // 由於是桌面應用程式，必須將 StoreContext 關聯至當前視窗 (HWND)
    let initializer: IInitializeWithWindow = context.cast()
        .map_err(|e| format!("無法將 StoreContext 轉型為 IInitializeWithWindow: {}", e))?;

    unsafe {
        initializer.Initialize(hwnd)
            .map_err(|e| format!("無法使用 HWND 初始化 StoreContext: {}", e))?;
    }

    // 同步等待非同步取得 App 授權資訊
    let async_op = context.GetAppLicenseAsync()
        .map_err(|e| format!("呼叫 GetAppLicenseAsync 失敗: {}", e))?;

    let license = async_op.get()
        .map_err(|e| format!("等待 GetAppLicenseAsync 逾時或出錯: {}", e))?;

    let is_active = license.IsActive()
        .map_err(|e| format!("讀取 IsActive 失敗: {}", e))?;
    let is_trial = license.IsTrial()
        .map_err(|e| format!("讀取 IsTrial 失敗: {}", e))?;

    let mut trial_days_remaining = 0;
    if is_trial {
        if let Ok(expiration_date) = license.ExpirationDate() {
            // Windows WinRT DateTime 單位為 100 奈秒 (自 1601 年 1 月 1 日起計算)
            let universal_time = expiration_date.UniversalTime; // i64 ticks
            let expiration_seconds = (universal_time / 10_000_000) - 11_644_473_600;
            
            // 取得目前時間的 UNIX 時間戳 (秒)
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0) as i64;
            
            let seconds_remaining = expiration_seconds - now;
            trial_days_remaining = if seconds_remaining > 0 {
                // 無條件進位計算天數
                (seconds_remaining + 86400 - 1) / 86400
            } else {
                0
            };
        }
    }

    Ok(LicenseStatus {
        is_active,
        is_trial,
        trial_days_remaining,
    })
}

#[cfg(all(not(debug_assertions), feature = "store", not(target_os = "windows")))]
fn check_windows_store_license_impl(_window: tauri::Window) -> Result<LicenseStatus, String> {
    Err("微軟商店授權檢查僅支援 Windows 平台。".to_string())
}

#[tauri::command]
fn get_build_target() -> String {
    if cfg!(feature = "store") {
        "STORE".to_string()
    } else {
        "GITHUB".to_string()
    }
}

#[tauri::command]
#[allow(deprecated)]
async fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    app.shell().open(url, None).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }))
    .invoke_handler(tauri::generate_handler![check_windows_store_license, get_build_target, open_external_url])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
