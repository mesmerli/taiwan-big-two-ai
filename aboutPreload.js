const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aboutAPI', {
  getBuildTarget: () => ipcRenderer.sendSync('get-build-target'),
  getAppInfo: () => ipcRenderer.sendSync('get-app-info'),
  getLicenseStatus: () => ipcRenderer.sendSync('get-license-status-sync'),
  openExternal: (url) => ipcRenderer.send('open-external-url', url),
  closeWindow: () => ipcRenderer.send('close-about-window')
});
