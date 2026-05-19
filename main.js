const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const I18N = require('./src/i18n.js');

// Set AppUserModelId for Windows Taskbar/JumpList consistency
if (process.platform === 'win32') {
  app.setAppUserModelId('mesmerli.TaiwanBig2AI.debug');
}

let currentLang = 'zh'; // Default

let win = null;

// Explicitly set the app name for consistent UI behavior
app.name = 'Taiwan Big Two AI';

// Set App User Model ID for Windows Jump Lists to work reliably
const appId = 'com.mesmerli.taiwanbig2ai';
app.setAppUserModelId(appId);

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#1a1a1a', // Premium dark background
    title: 'Taiwan Big Two AI',
    icon: path.join(__dirname, 'src/assets/logo.png')
  });

  win.setMenu(null);
  win.loadFile('index.html');
  
  // Microsoft Store Trial Support Integration
  // Use did-finish-load to ensure the renderer's ipcRenderer listeners are ready
  win.webContents.once('did-finish-load', () => {
    if (process.platform === 'win32') {
      checkStoreLicense();
    }
  });

  // Alternative to F12: Ctrl+Shift+I to toggle DevTools (Detached mode)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
      event.preventDefault();
    }
  });
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      
      // Check if --about was passed from Jump List
      if (commandLine.includes('--about')) {
        showAboutDialog();
      }
    }
  });

  app.whenReady().then(() => {
    createWindow();

    // Add Taskbar Jump List (Windows Right-click Menu)
    updateJumpList();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    // Listen for language updates from renderer
    ipcMain.on('update-lang', (event, lang) => {
      currentLang = lang;
      updateJumpList(); // Refresh Jump List with new language
    });

    ipcMain.on('show-about', showAboutDialog);

    // Build target and license status IPC handlers for renderer processes
    ipcMain.on('get-build-target', (event) => {
      event.returnValue = process.env.BUILD_TARGET || 'GITHUB';
    });

    ipcMain.on('get-app-info', (event) => {
      const pkg = require('./package.json');
      event.returnValue = {
        version: pkg.buildVersion || pkg.version,
        author: pkg.author || 'mesmerli'
      };
    });

    ipcMain.on('get-license-status-sync', (event) => {
      event.returnValue = appLicense;
    });

    ipcMain.on('close-about-window', (event) => {
      const webContents = event.sender;
      const w = BrowserWindow.fromWebContents(webContents);
      if (w) {
        w.close();
      }
    });

    ipcMain.on('open-external-url', (event, url) => {
      shell.openExternal(url);
    });
  });
}

ipcMain.on('open-store', async () => {
  const storeUrl = `ms-windows-store://pdp/?ProductId=${STORE_PRODUCT_ID}`;
  const webUrl = `https://apps.microsoft.com/store/detail/${STORE_PRODUCT_ID}`;
  
  try {
    await shell.openExternal(storeUrl);
  } catch (err) {
    console.error('[Store] Protocol failed, opening web version:', err);
    shell.openExternal(webUrl);
  }
});

function updateJumpList() {
  if (process.platform !== 'win32') return;

  const t = (key) => I18N[currentLang][key] || key;

  // 明確指定 program 路徑，避免 Electron 內部轉換錯誤 (TypeError)
  const success = app.setUserTasks([
    {
      program: process.execPath,
      arguments: '--about',
      title: t('menuAbout'),
      description: 'Taiwan Big Two AI'
    }
  ]);

  console.log(`[JumpList] User Tasks set success: ${success}`);
}

function showAboutDialog() {
  const aboutWin = new BrowserWindow({
    width: 400,
    height: 450,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false, // No border, no title bar, no buttons
    modal: false,
    parent: win,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'aboutPreload.js')
    },
    backgroundColor: '#0f172a'
  });

  aboutWin.loadURL(`file://${__dirname}/about.html?lang=${currentLang}`);
  aboutWin.once('ready-to-show', () => aboutWin.show());
  
  // Close when clicking outside (losing focus)
  aboutWin.on('blur', () => {
    aboutWin.close();
  });
}


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- Microsoft Store Licensing Logic ---
let storeBridge = null;
const STORE_PRODUCT_ID = "9PM1S8GKBLK9"; // Official Microsoft Store Product ID
let appLicense = null;

async function checkStoreLicense() {
  if (process.platform !== 'win32' || !win) return;

  try {
    // 載入原生 C++ 插件
    if (!storeBridge) {
      try {
        storeBridge = require('./StoreBridge/build/Release/StoreBridge.node');
      } catch (e) {
        console.warn('[Store] 找不到 StoreBridge.node 插件，略過授權檢查。');
        return;
      }
    }

    const hwnd = win.getNativeWindowHandle().readBigInt64LE();
    const license = await storeBridge.getLicenseStatus(hwnd);
    
    console.log('[Store] 取得授權狀態:', license);
    await processLicense(license);

  } catch (err) {
    console.error('[Store] 授權檢查異常:', err);
  }
}

async function processLicense(license) {
  // --- 測試模擬區 (正式上架前請將此段刪除) ---
  /*
  const mockFutureDate = new Date();
  mockFutureDate.setDate(mockFutureDate.getDate() + 7);
  license = {
    isActive: true,
    isTrial: true,
    expirationDate: mockFutureDate.toISOString()
  };
  console.log('[Store] 正在模擬試用狀態 (7天後過期)...');
  */
  // ---------------------------------------

  appLicense = license; // Store globally

  if (!license || !license.isActive) {
    console.warn('[Store] 無法取得有效授權。');
    return;
  }

  if (license.isTrial) {
    const now = new Date();
    const expirationDate = new Date(license.expirationDate);
    console.log(`[Store] 試用版運作中，到期日: ${expirationDate}`);

    if (now >= expirationDate) {
      console.error('[Store] 試用期已屆滿！');
      handleTrialExpired();
    } else {
      const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
      console.log(`[Store] 試用剩餘天數: ${daysLeft} 天`);
      if (win) win.webContents.send('license-status', { isTrial: true, daysLeft: daysLeft });
    }
  } else {
    console.log('[Store] 檢測到完整版，感謝購買！');
    if (win) win.webContents.send('license-status', { isFullVersion: true });
  }
}

function handleTrialExpired() {
  // Inform the user and redirect to the Store page
  const result = dialog.showMessageBoxSync(win, {
    type: 'warning',
    title: 'Trial Expired',
    message: 'Your trial period for Taiwan Big Two AI has expired. Would you like to purchase the full version from the Microsoft Store?',
    buttons: ['Purchase Now', 'Close App'],
    defaultId: 0,
    cancelId: 1
  });

  if (result === 0) {
    shell.openExternal(`ms-windows-store://pdp/?ProductId=${STORE_PRODUCT_ID}`);
  }
  
  app.quit();
}
