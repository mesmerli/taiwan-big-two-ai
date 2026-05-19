/**
 * System Service Adapter Layer
 * 統一封裝：檔案讀取 (ReadFile)、檔案寫入 (WriteFile)、外部連結開啟 (OpenExternal)
 * 相容：Tauri (v1/v2)、Electron、Capacitor、Web 瀏覽器
 */

(function (global) {
    
    /**
     * 輔促工具：安全獲取 Electron 的 ipcRenderer
     */
    function getElectronIpc() {
        if (typeof require !== 'undefined') {
            try {
                return require('electron').ipcRenderer;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    const SystemService = {
        /**
         * 1. 外部連結開啟 (Open External Links)
         * @param {string} url - 目標 URL
         */
        async openExternal(url) {
            console.log(`[SystemService] Opening external link: ${url} on ${AppEnv.getPlatformName()}`);
            
            // A. Tauri 環境
            if (AppEnv.isTauri) {
                try {
                    if (window.__TAURI__ && window.__TAURI__.shell) {
                        await window.__TAURI__.shell.open(url);
                    } else if (window.__TAURI__ && window.__TAURI__.path) {
                        const { open } = window.__TAURI__.shell;
                        await open(url);
                    } else {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                } catch (e) {
                    console.error("[Tauri] Shell open failed, falling back to window.open", e);
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
                return;
            }

            // B. Electron 環境
            if (AppEnv.isElectron) {
                try {
                    const { shell } = require('electron');
                    shell.openExternal(url);
                } catch (e) {
                    console.error("[Electron] Shell open failed", e);
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
                return;
            }

            // C. Capacitor (Android) 環境
            if (AppEnv.isAndroid && window.Capacitor && window.Capacitor.Plugins.Browser) {
                try {
                    await window.Capacitor.Plugins.Browser.open({ url });
                } catch (e) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
                return;
            }

            // D. 標準瀏覽器環境 (Web)
            window.open(url, '_blank', 'noopener,noreferrer');
        },

        /**
         * 2. 統一檔案寫入/匯出 (Write & Export File)
         * @param {string} defaultFilename - 預設檔案名稱
         * @param {object|string} data - 要寫入的資料 (對象或字串)
         */
        async writeFile(defaultFilename, data) {
            const contentString = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
            
            // A. Tauri 環境：直接開啟 Native「儲存檔案」對話框寫入硬碟
            if (AppEnv.isTauri) {
                try {
                    const { dialog, fs } = window.__TAURI__;
                    const savePath = await dialog.save({
                        defaultPath: defaultFilename,
                        filters: [{ name: 'JSON Data', extensions: ['json'] }]
                    });

                    if (savePath) {
                        if (typeof fs.writeFile === 'function') {
                            await fs.writeFile({ path: savePath, contents: contentString });
                        } else if (typeof fs.writeTextFile === 'function') {
                            await fs.writeTextFile(savePath, contentString);
                        }
                        return { success: true, path: savePath };
                    }
                    return { success: false, reason: 'cancelled' };
                } catch (e) {
                    console.error("[Tauri] WriteFile failed, falling back to Web download", e);
                }
            }

            // B. Electron 環境：經由 IPC 傳送至 Main Process 寫入 (配合安全實踐)
            if (AppEnv.isElectron) {
                const ipc = getElectronIpc();
                if (ipc) {
                    try {
                        const result = await ipc.invoke('save-file-dialog', {
                            defaultFilename,
                            content: contentString
                        });
                        return result;
                    } catch (e) {
                        console.error("[Electron] IPC WriteFile failed, using fallback", e);
                    }
                }
            }

            // C. 網頁端/行動端相容 (Browser / Capacitor Web)
            try {
                const blob = new Blob([contentString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = defaultFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return { success: true, type: 'download' };
            } catch (e) {
                console.error("[Browser] File download failed", e);
                throw e;
            }
        },

        /**
         * 3. 統一檔案讀取/匯入 (Read & Import File)
         * @param {object} options - 讀取選項 (例如 { accept: '.json' })
         * @returns {Promise<object>} - 解析後的文件內容 JSON 物件或字串
         */
        async readFile(options = { accept: '.json' }) {
            // A. Tauri 環境：直接開啟 Native「選取檔案」對話框並讀取
            if (AppEnv.isTauri) {
                try {
                    const { dialog, fs } = window.__TAURI__;
                    const selectedPath = await dialog.open({
                        multiple: false,
                        filters: [{ name: 'JSON Data', extensions: ['json'] }]
                    });

                    if (selectedPath && !Array.isArray(selectedPath)) {
                        let content = '';
                        if (typeof fs.readTextFile === 'function') {
                            content = await fs.readTextFile(selectedPath);
                        } else if (typeof fs.readFile === 'function') {
                            const bytes = await fs.readFile(selectedPath);
                            content = new TextDecoder().decode(bytes);
                        }
                        
                        return { 
                            success: true, 
                            data: JSON.parse(content), 
                            filename: selectedPath 
                        };
                    }
                    return { success: false, reason: 'cancelled' };
                } catch (e) {
                    console.error("[Tauri] ReadFile failed, falling back to browser selector", e);
                }
            }

            // B. Electron 環境：使用 IPC 呼叫 Main Process 開啟檔案並讀取
            if (AppEnv.isElectron) {
                const ipc = getElectronIpc();
                if (ipc) {
                    try {
                        const result = await ipc.invoke('open-file-dialog', options);
                        if (result && result.success) {
                            return {
                                success: true,
                                data: JSON.parse(result.content),
                                filename: result.filename
                            };
                        }
                        return { success: false, reason: 'cancelled' };
                    } catch (e) {
                        console.error("[Electron] IPC ReadFile failed", e);
                    }
                }
            }

            // C. 網頁端/行動端相容 (Browser / Capacitor Web)
            return new Promise((resolve, reject) => {
                try {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = options.accept || '*';
                    input.style.display = 'none';

                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) {
                            resolve({ success: false, reason: 'cancelled' });
                            return;
                        }

                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const parsedData = JSON.parse(event.target.result);
                                resolve({
                                    success: true,
                                    data: parsedData,
                                    filename: file.name
                                });
                            } catch (err) {
                                reject(new Error("Invalid JSON file format"));
                            }
                        };
                        reader.onerror = () => reject(new Error("File read error"));
                        reader.readAsText(file);
                    };

                    document.body.appendChild(input);
                    input.click();
                    document.body.removeChild(input);
                } catch (e) {
                    reject(e);
                }
            });
        }
    };

    global.SystemService = SystemService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SystemService;
    }
})(typeof window !== 'undefined' ? window : this);
