/**
 * Unified License Service Module
 * 統一封裝：微軟商店授權與試用期檢查
 * 相容：Tauri (v1/v2)、Electron、Web 瀏覽器
 */

(function (global) {
    let cachedStatus = null;
    let cachedBuildTarget = null;

    /**
     * 輔助工具：動態且安全地載入 Tauri 的 invoke 函數
     */
    async function getTauriInvoke() {
        if (typeof window !== 'undefined' && window.__TAURI__) {
            // Tauri v2 全域變數
            if (window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
                return window.__TAURI__.core.invoke;
            }
            // Tauri v1 全域變數
            if (typeof window.__TAURI__.invoke === 'function') {
                return window.__TAURI__.invoke;
            }
        }
        
        // 嘗試使用 ESM 動態載入 (適用於打包工具編譯環境)
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            return invoke;
        } catch (e) {
            try {
                const { invoke } = await import('@tauri-apps/api/tauri');
                return invoke;
            } catch (err) {
                return null;
            }
        }
    }

    /**
     * 呼叫 Tauri Rust 後端命令
     */
    async function checkTauriLicense() {
        try {
            const invoke = await getTauriInvoke();
            if (invoke) {
                const status = await invoke('check_windows_store_license');
                return {
                    isActive: !!status.is_active,
                    isTrial: !!status.is_trial,
                    trialDaysRemaining: Number(status.trial_days_remaining || 0)
                };
            }
        } catch (e) {
            console.error('[LicenseService] 呼叫 Tauri 授權命令失敗:', e);
        }
        // 失敗時的防呆回傳
        return { isActive: false, isTrial: false, trialDaysRemaining: 0 };
    }

    /**
     * 呼叫 Electron StoreBridge 綁定
     */
    async function checkElectronLicense() {
        if (typeof require !== 'undefined') {
            try {
                const electron = require('electron');
                const ipc = electron.ipcRenderer;
                if (ipc) {
                    const raw = ipc.sendSync('get-license-status-sync');
                    if (!raw) return { isActive: false, isTrial: false, trialDaysRemaining: 0 };

                    let trialDaysRemaining = 0;
                    if (raw.isTrial && raw.expirationDate) {
                        const now = new Date();
                        const expirationDate = new Date(raw.expirationDate);
                        trialDaysRemaining = Math.max(0, Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24)));
                    }

                    return {
                        isActive: !!raw.isActive,
                        isTrial: !!raw.isTrial,
                        trialDaysRemaining
                    };
                }
            } catch (e) {
                console.warn('[LicenseService] 取得 Electron 授權狀態失敗:', e);
            }
        }
        return { isActive: false, isTrial: false, trialDaysRemaining: 0 };
    }

    const LicenseService = {
        /**
         * 初始化服務，非同步載入授權與建置目標，快取至記憶體中
         */
        async init() {
            // 1. 取得並快取授權狀態
            await this.getLicenseStatus();
            
            // 2. 取得並快取建置目標 (STORE 或是 GITHUB)
            const isTauriEnv = typeof AppEnv !== 'undefined' ? AppEnv.isTauri : 
                                 (typeof window !== 'undefined' && 
                                  (window.__TAURI_METADATA__ !== undefined || 
                                   window.__TAURI__ !== undefined || 
                                   window.__TAURI_INTERNALS__ !== undefined));
            
            const isElectronEnv = typeof AppEnv !== 'undefined' ? AppEnv.isElectron : 
                                 (typeof window !== 'undefined' && 
                                  ((window.process && window.process.versions && !!window.process.versions.electron) || 
                                   (navigator && navigator.userAgent && navigator.userAgent.includes('Electron'))));

            if (isElectronEnv && typeof require !== 'undefined') {
                try {
                    const electron = require('electron');
                    cachedBuildTarget = electron.ipcRenderer ? electron.ipcRenderer.sendSync('get-build-target') : 'GITHUB';
                } catch (e) {}
            } else if (isTauriEnv) {
                try {
                    const invoke = await getTauriInvoke();
                    if (invoke) {
                        cachedBuildTarget = await invoke('get_build_target');
                    }
                } catch (e) {}
            }

            if (!cachedBuildTarget) {
                cachedBuildTarget = 'GITHUB';
            }
            window.BuildTarget = cachedBuildTarget;
        },

        /**
         * 取得建置目標 (同步存取快取)
         * @returns {string} - 'STORE' 或 'GITHUB'
         */
        getBuildTarget() {
            if (cachedBuildTarget) return cachedBuildTarget;
            if (window.BuildTarget) return window.BuildTarget;

            // 備用同步讀取 (僅適用 Electron)
            const isElectronEnv = typeof AppEnv !== 'undefined' ? AppEnv.isElectron : 
                                 (typeof window !== 'undefined' && 
                                  ((window.process && window.process.versions && !!window.process.versions.electron) || 
                                   (navigator && navigator.userAgent && navigator.userAgent.includes('Electron'))));

            if (isElectronEnv && typeof require !== 'undefined') {
                try {
                    const electron = require('electron');
                    return electron.ipcRenderer ? electron.ipcRenderer.sendSync('get-build-target') : 'GITHUB';
                } catch (e) {}
            }
            return 'GITHUB';
        },

        /**
         * 1. 統一非同步取得授權與試用期狀態
         * @returns {Promise<{isActive: boolean, isTrial: boolean, trialDaysRemaining: number}>}
         */
        async getLicenseStatus() {
            let status;
            
            if (typeof AppEnv !== 'undefined') {
                if (AppEnv.isTauri) {
                    status = await checkTauriLicense();
                } else if (AppEnv.isElectron) {
                    status = await checkElectronLicense();
                } else {
                    // 瀏覽器或其他平台（如 Android/Capacitor）預設為已啟用完整版
                    status = { isActive: true, isTrial: false, trialDaysRemaining: 0 };
                }
            } else {
                // 如果 AppEnv 尚未載入的防呆邏輯
                const isTauriEnv = typeof window !== 'undefined' && 
                                  (window.__TAURI_METADATA__ !== undefined || 
                                   window.__TAURI__ !== undefined || 
                                   window.__TAURI_INTERNALS__ !== undefined);
                const isElectronEnv = typeof window !== 'undefined' && 
                                     ((window.process && window.process.versions && !!window.process.versions.electron) || 
                                      (navigator && navigator.userAgent && navigator.userAgent.includes('Electron')));

                if (isTauriEnv) {
                    status = await checkTauriLicense();
                } else if (isElectronEnv) {
                    status = await checkElectronLicense();
                } else {
                    status = { isActive: true, isTrial: false, trialDaysRemaining: 0 };
                }
            }

            cachedStatus = status;
            return status;
        },

        /**
         * 2. 統一同步取得授權快取（避免渲染執行緒因為非同步等待而卡頓）
         * @returns {{isActive: boolean, isTrial: boolean, trialDaysRemaining: number}}
         */
        getLicenseStatusSync() {
            if (cachedStatus) return cachedStatus;

            // 若尚未有快取，但在 Electron 中可以透過同步 IPC 立即拿到
            const isElectronEnv = typeof AppEnv !== 'undefined' ? AppEnv.isElectron : 
                                 (typeof window !== 'undefined' && 
                                  ((window.process && window.process.versions && !!window.process.versions.electron) || 
                                   (navigator && navigator.userAgent && navigator.userAgent.includes('Electron'))));

            if (isElectronEnv && typeof require !== 'undefined') {
                try {
                    const electron = require('electron');
                    const raw = electron.ipcRenderer.sendSync('get-license-status-sync');
                    if (raw) {
                        let trialDaysRemaining = 0;
                        if (raw.isTrial && raw.expirationDate) {
                            const now = new Date();
                            const expirationDate = new Date(raw.expirationDate);
                            trialDaysRemaining = Math.max(0, Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24)));
                        }
                        cachedStatus = {
                            isActive: !!raw.isActive,
                            isTrial: !!raw.isTrial,
                            trialDaysRemaining
                        };
                        return cachedStatus;
                    }
                } catch (e) {}
            }

            // Tauri 與 瀏覽器若尚未有快取，先回傳預設空狀態（非同步 getLicenseStatus 完成後會填入快取並重繪）
            return {
                isActive: false,
                isTrial: false,
                trialDaysRemaining: 0
            };
        },

        /**
         * 統一導向微軟商店產品頁面
         */
        async openStore() {
            const isTauriEnv = typeof AppEnv !== 'undefined' ? AppEnv.isTauri : 
                                 (typeof window !== 'undefined' && 
                                  (window.__TAURI_METADATA__ !== undefined || 
                                   window.__TAURI__ !== undefined || 
                                   window.__TAURI_INTERNALS__ !== undefined));
            
            const isElectronEnv = typeof AppEnv !== 'undefined' ? AppEnv.isElectron : 
                                 (typeof window !== 'undefined' && 
                                  ((window.process && window.process.versions && !!window.process.versions.electron) || 
                                   (navigator && navigator.userAgent && navigator.userAgent.includes('Electron'))));
            
            const storeUrl = 'ms-windows-store://pdp/?ProductId=9PM1S8GKBLK9';
            
            if (isElectronEnv) {
                if (typeof require !== 'undefined') {
                    try {
                        const electron = require('electron');
                        if (electron.ipcRenderer) {
                            electron.ipcRenderer.send('open-store');
                            return;
                        }
                    } catch (e) {}
                }
                if (typeof SystemService !== 'undefined') {
                    SystemService.openExternal(storeUrl);
                }
            } else if (isTauriEnv) {
                try {
                    const invoke = await getTauriInvoke();
                    if (invoke) {
                        await invoke('open_external_url', { url: storeUrl });
                    }
                } catch (e) {
                    console.error('[LicenseService] 呼叫 Tauri 開啟外部連結失敗:', e);
                }
            } else {
                window.open(storeUrl, '_blank');
            }
        }
    };

    global.LicenseService = LicenseService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LicenseService;
    }
})(typeof window !== 'undefined' ? window : this);
