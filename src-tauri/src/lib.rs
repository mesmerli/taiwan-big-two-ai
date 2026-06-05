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

fn show_about_window_impl(app_handle: &tauri::AppHandle, lang: Option<String>) -> Result<(), String> {
  if let Some(about_win) = app_handle.get_webview_window("about") {
    let _ = about_win.unminimize();
    let _ = about_win.set_focus();
    return Ok(());
  }

  let lang_str = lang.unwrap_or_else(|| "zh".to_string());
  let build_target = if cfg!(feature = "store") { "STORE" } else { "GITHUB" };
  let query = format!(
    "about.html?lang={}&buildTarget={}&version=1.5.44&author=mesmerli&isActive=true&isTrial=false",
    lang_str, build_target
  );

  let about_url = tauri::WebviewUrl::App(query.into());
  let builder = tauri::WebviewWindowBuilder::new(app_handle, "about", about_url)
    .title("關於台灣大老二 AI")
    .inner_size(520.0, 480.0)
    .resizable(false)
    .fullscreen(false)
    .decorations(false)
    .visible(false)
    .center();

  let _about_win = builder.build().map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn show_about_window(app_handle: tauri::AppHandle, lang: Option<String>) -> Result<(), String> {
  show_about_window_impl(&app_handle, lang)
}

#[tauri::command]
fn update_jump_list(lang: String) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    update_tauri_jump_list(&lang)
  }
  #[cfg(not(target_os = "windows"))]
  {
    let _ = lang;
    Ok(())
  }
}

#[cfg(target_os = "windows")]
fn update_tauri_jump_list(lang: &str) -> Result<(), String> {
  use windows::core::{HSTRING, Interface, PCWSTR};
  use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    COINIT_DISABLE_OLE1DDE,
  };
  use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
  use windows::Win32::UI::Shell::{
    DestinationList, EnumerableObjectCollection, ShellLink, ICustomDestinationList, IShellLinkW,
  };
  use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
  use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
  use windows::Win32::Foundation::PROPERTYKEY;

  // Define PKEY_Title locally to avoid versioning/module dependency path issues
  #[allow(non_upper_case_globals)]
  const PKEY_Title: PROPERTYKEY = PROPERTYKEY {
    fmtid: windows::core::GUID::from_u128(0xF29F85E0_4FF9_1068_AB91_08002B27B3D9),
    pid: 2,
  };

  unsafe fn alloc_co_task_mem_string(s: &str) -> windows::core::PWSTR {
    let wide: Vec<u16> = s.encode_utf16().chain(std::iter::once(0)).collect();
    let bytes = wide.len() * std::mem::size_of::<u16>();
    let ptr = windows::Win32::System::Com::CoTaskMemAlloc(bytes) as *mut u16;
    if !ptr.is_null() {
      std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
    }
    windows::core::PWSTR(ptr)
  }

  unsafe {
    let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);

    let dest_list: ICustomDestinationList = CoCreateInstance(&DestinationList, None, CLSCTX_INPROC_SERVER)
      .map_err(|e| format!("Failed to create ICustomDestinationList: {}", e))?;

    let mut max_slots = 0u32;
    let _removed_destinations: IObjectArray = dest_list.BeginList(&mut max_slots)
      .map_err(|e| format!("BeginList failed: {}", e))?;

    let collection: IObjectCollection = CoCreateInstance(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER)
      .map_err(|e| format!("Failed to create IObjectCollection: {}", e))?;

    let shell_link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)
      .map_err(|e| format!("Failed to create IShellLinkW: {}", e))?;

    let current_exe = std::env::current_exe()
      .map_err(|e| format!("Failed to get current exe path: {}", e))?;
    let current_exe_str = current_exe.to_string_lossy().to_string();
    let current_exe_hstring = HSTRING::from(&current_exe_str);

    shell_link.SetPath(PCWSTR(current_exe_hstring.as_ptr()))
      .map_err(|e| format!("SetPath failed: {}", e))?;

    let args_hstring = HSTRING::from("--about");
    shell_link.SetArguments(PCWSTR(args_hstring.as_ptr()))
      .map_err(|e| format!("SetArguments failed: {}", e))?;

    shell_link.SetIconLocation(PCWSTR(current_exe_hstring.as_ptr()), 0)
      .map_err(|e| format!("SetIconLocation failed: {}", e))?;

    let property_store: IPropertyStore = shell_link.cast()
      .map_err(|e| format!("Cast to IPropertyStore failed: {}", e))?;

    let title_str = if lang == "zh" {
      "關於台灣大老二 AI"
    } else {
      "About Taiwan Big2 AI"
    };

    let pwsz_title = alloc_co_task_mem_string(title_str);
    if pwsz_title.is_null() {
      return Err("Failed to allocate COM task memory for title string".to_string());
    }

    let mut propvar = PROPVARIANT::default();

    // Use ptr::write to safely set ManuallyDrop union fields of PROPVARIANT
    let anonymous = &mut propvar.Anonymous;
    let inner_ptr: *mut windows::Win32::System::Com::StructuredStorage::PROPVARIANT_0_0 = &mut (*anonymous.Anonymous) as *mut _;
    std::ptr::write(&mut (*inner_ptr).vt, windows::Win32::System::Variant::VARENUM(31)); // VT_LPWSTR
    std::ptr::write(&mut (*inner_ptr).Anonymous.pwszVal, pwsz_title);

    property_store.SetValue(&PKEY_Title, &propvar)
      .map_err(|e| format!("SetValue failed: {}", e))?;

    property_store.Commit()
      .map_err(|e| format!("Commit property store failed: {}", e))?;

    let unknown: windows::core::IUnknown = shell_link.cast()
      .map_err(|e| format!("Cast shell link to IUnknown failed: {}", e))?;

    collection.AddObject(&unknown)
      .map_err(|e| format!("AddObject failed: {}", e))?;

    let array: IObjectArray = collection.cast()
      .map_err(|e| format!("Cast collection failed: {}", e))?;

    dest_list.AddUserTasks(&array)
      .map_err(|e| format!("AddUserTasks failed: {}", e))?;

    dest_list.CommitList()
      .map_err(|e| format!("CommitList failed: {}", e))?;
  }

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
      let mut is_about = false;
      for arg in args {
        if arg == "--about" {
          is_about = true;
          break;
        }
      }
      if is_about {
        let _ = show_about_window_impl(app, None);
      } else {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    }))
    .invoke_handler(tauri::generate_handler![
      check_windows_store_license,
      get_build_target,
      open_external_url,
      show_about_window,
      update_jump_list
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Check startup args
      let args: Vec<String> = std::env::args().collect();
      let has_about = args.iter().any(|arg| arg == "--about");

      if has_about {
        let _ = show_about_window_impl(app.handle(), None);
      } else {
        if let Some(main_win) = app.get_webview_window("main") {
          let _ = main_win.show();
          let _ = main_win.set_focus();
        }
      }

      // Exit application when main window is closed
      if let Some(main_win) = app.get_webview_window("main") {
        let app_handle = app.handle().clone();
        main_win.on_window_event(move |event| {
          if let tauri::WindowEvent::Destroyed = event {
            app_handle.exit(0);
          }
        });
      }

      // Initialize Jump List on startup
      #[cfg(target_os = "windows")]
      {
        let _ = update_tauri_jump_list("zh");
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
