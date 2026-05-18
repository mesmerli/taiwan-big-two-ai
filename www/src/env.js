/**
 * Taiwan Big Two AI - Environment & Storage Module
 * Supports Electron, Android (Capacitor), and general web browsers.
 */

(function (global) {
    // 1. Detect Platforms
    const isElectron = typeof window !== 'undefined' && 
                       ((window.process && window.process.versions && !!window.process.versions.electron) || 
                        (navigator && navigator.userAgent && navigator.userAgent.includes('Electron')));

    const isAndroid = typeof window !== 'undefined' && 
                      window.Capacitor && 
                      ((window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android') || 
                       window.Capacitor.platform === 'android');

    const isBrowser = !isElectron && !isAndroid;

    const AppEnv = {
        isElectron,
        isAndroid,
        isBrowser,
        getPlatformName() {
            if (isElectron) return 'Electron';
            if (isAndroid) return 'Android (Capacitor)';
            return 'Browser';
        }
    };

    // Helper to get Capacitor Preferences or Storage plugin safely
    const getPreferencesPlugin = () => {
        if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) {
            return window.Capacitor.Plugins.Preferences || window.Capacitor.Plugins.Storage;
        }
        return null;
    };

    // 2. Storage Abstraction with Sync-Safe Memory Cache
    const AppStorage = {
        cache: {},
        isInitialized: false,

        /**
         * Initializes the storage cache. Awaited at application startup.
         */
        async init() {
            if (this.isInitialized) return;

            // 1. Always load localStorage into the cache first (so existing Web/Electron data is preserved)
            this.loadAllFromLocalStorage();

            // 2. If on Android and Capacitor Preferences is available, overlay its data onto the cache
            const plugin = getPreferencesPlugin();
            if (isAndroid && plugin) {
                try {
                    if (typeof plugin.keys === 'function') {
                        const { keys } = await plugin.keys();
                        for (const key of keys) {
                            const { value } = await plugin.get({ key });
                            if (value !== null) {
                                this.cache[key] = value;
                            }
                        }
                    } else {
                        // Pre-load manual keys as fallback
                        const keysToLoad = ['soundMode', 'ai_settings_Diana', 'ai_memory_Diana', 'ai_settings_Ares', 'ai_memory_Ares'];
                        for (const key of keysToLoad) {
                            const { value } = await plugin.get({ key });
                            if (value !== null) {
                                this.cache[key] = value;
                            }
                        }
                    }
                } catch (e) {
                    console.error("[AppStorage] Capacitor Preferences init failed, using localStorage only:", e);
                }
            }
            this.isInitialized = true;
            console.log(`[AppStorage] Initialized on ${AppEnv.getPlatformName()}. Cached keys count:`, Object.keys(this.cache).length);
        },

        loadAllFromLocalStorage() {
            try {
                if (typeof localStorage !== 'undefined') {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        this.cache[key] = localStorage.getItem(key);
                    }
                }
            } catch (e) {
                console.error("[AppStorage] Failed to load from localStorage:", e);
            }
        },

        // --- Synchronous APIs (using cache) ---
        getItem(key) {
            if (key in this.cache) {
                return this.cache[key];
            }
            // Fallback read from localStorage
            try {
                if (typeof localStorage !== 'undefined') {
                    const val = localStorage.getItem(key);
                    this.cache[key] = val;
                    return val;
                }
            } catch (e) {}
            return null;
        },

        setItem(key, value) {
            const strValue = String(value);
            this.cache[key] = strValue;

            // Dual write to localStorage for durability/fallback
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(key, strValue);
                }
            } catch (e) {
                console.error("[AppStorage] localStorage setItem failed:", e);
            }

            // Asynchronously write to Capacitor Preferences in the background
            const plugin = getPreferencesPlugin();
            if (isAndroid && plugin) {
                plugin.set({ key, value: strValue }).catch(e => {
                    console.error("[AppStorage] Capacitor Preferences set failed:", e);
                });
            }
        },

        removeItem(key) {
            delete this.cache[key];

            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                console.error("[AppStorage] localStorage removeItem failed:", e);
            }

            const plugin = getPreferencesPlugin();
            if (isAndroid && plugin) {
                plugin.remove({ key }).catch(e => {
                    console.error("[AppStorage] Capacitor Preferences remove failed:", e);
                });
            }
        },

        clear() {
            this.cache = {};

            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.clear();
                }
            } catch (e) {
                console.error("[AppStorage] localStorage clear failed:", e);
            }

            const plugin = getPreferencesPlugin();
            if (isAndroid && plugin) {
                plugin.clear().catch(e => {
                    console.error("[AppStorage] Capacitor Preferences clear failed:", e);
                });
            }
        },

        // --- Pure Asynchronous APIs (for explicit async calls if desired) ---
        async getItemAsync(key) {
            const plugin = getPreferencesPlugin();
            if (isAndroid && plugin) {
                try {
                    const { value } = await plugin.get({ key });
                    this.cache[key] = value;
                    return value;
                } catch (e) {
                    console.warn("[AppStorage] Async get failed, falling back to local cache/localStorage:", e);
                }
            }
            return this.getItem(key);
        },

        async setItemAsync(key, value) {
            const strValue = String(value);
            this.cache[key] = strValue;
            
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(key, strValue);
                }
            } catch (e) {}

            const plugin = getPreferencesPlugin();
            if (isAndroid && plugin) {
                await plugin.set({ key, value: strValue });
            }
        }
    };

    // Expose globals
    global.AppEnv = AppEnv;
    global.AppStorage = AppStorage;

})(typeof window !== 'undefined' ? window : this);
