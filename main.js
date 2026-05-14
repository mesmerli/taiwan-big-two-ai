const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const I18N = require('./src/i18n.js');

let currentLang = 'zh'; // Default

let win = null;

// Explicitly set the app name for consistent UI behavior
app.name = 'Taiwan Big Two AI';

// Set App User Model ID for Windows Jump Lists to work reliably
const appId = 'com.mesmerli.taiwanbigtwoai';
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
  });
}

function updateJumpList() {
  if (process.platform !== 'win32') return;

  const appPath = path.join(__dirname, '.');
  const t = (key) => I18N[currentLang][key] || key;

  app.setUserTasks([
    {
      program: process.execPath,
      arguments: `"${appPath}" --about`,
      iconPath: process.execPath,
      iconIndex: 0,
      title: t('menuAbout'),
      description: 'Taiwan Big Two AI'
    }
  ]);
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
      nodeIntegration: true,
      contextIsolation: false,
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
