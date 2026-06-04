/**
 * WebLlmCacheManager - Utility to manage downloaded WebLLM model caches
 */

export class WebLlmCacheManager {
    /**
     * Get all cache names in the browser starting with "webllm/"
     * @returns {Promise<string[]>} List of Cache API keys
     */
    // Available models to scan
    static MODELS = [
        { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 2B (f16 - High Performance)' },
        { id: 'gemma-2-2b-it-q4f32_1-MLC', name: 'Gemma 2 2B (f32 - High Compatibility)' },
        { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 1.5B (f16 - High Performance)' },
        { id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', name: 'Qwen 2.5 1.5B (f32 - High Compatibility)' },
        { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (f16)' },
        { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B (f16)' },
        { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 Mini 3.8B (f16)' }
    ];

    /**
     * Get all cached model IDs by scanning standard caches
     * @returns {Promise<string[]>} List of model IDs (e.g. ['gemma-2-2b-it-q4f16_1-MLC'])
     */
    static async listCachedModels() {
        if (typeof caches === 'undefined') return [];
        try {
            const cache = await caches.open('webllm/model');
            const keys = await cache.keys();
            const urls = keys.map(k => k.url.toLowerCase());

            // Check which of our supported models have files in the cache
            const cachedModels = [];
            for (const model of this.MODELS) {
                // If there are files containing the model's ID in the cache, it exists
                const modelIdLower = model.id.toLowerCase();
                const hasFiles = urls.some(url => url.includes(modelIdLower));
                if (hasFiles) {
                    cachedModels.push(model.id);
                }

                // If the model is an f16 version, also check if its f32 variant is in the cache
                if (model.id.includes('q4f16_1')) {
                    const f32Id = model.id.replace('q4f16_1', 'q4f32_1');
                    const f32IdLower = f32Id.toLowerCase();
                    const hasF32Files = urls.some(url => url.includes(f32IdLower));
                    if (hasF32Files) {
                        cachedModels.push(f32Id);
                    }
                }
            }

            // Fallback: If we have a generic custom/fallback model cache that is not in MODELS
            const keysRaw = await caches.keys();
            for (const key of keysRaw) {
                if (key.startsWith('webllm/') && key !== 'webllm/config' && key !== 'webllm/wasm' && key !== 'webllm/model') {
                    try {
                        const legacyCache = await caches.open(key);
                        const legacyKeys = await legacyCache.keys();
                        if (legacyKeys.length === 0) {
                            await caches.delete(key);
                        } else {
                            cachedModels.push(key.replace('webllm/', ''));
                        }
                    } catch (_) {
                        cachedModels.push(key.replace('webllm/', ''));
                    }
                }
            }

            return Array.from(new Set(cachedModels));
        } catch (e) {
            console.error('[WebLlmCacheManager] Failed to list caches:', e);
            return [];
        }
    }

    /**
     * Calculate the size of a specific model in the cache
     * @param {string} modelId Model ID
     * @returns {Promise<string>} Formatted size string (e.g. "1.2 GB")
     */
    static async getCacheSize(modelId) {
        if (typeof caches === 'undefined') return '0 MB';
        try {
            const cache = await caches.open('webllm/model');
            const keys = await cache.keys();
            let totalBytes = 0;
            const modelIdLower = modelId.toLowerCase();

            for (const key of keys) {
                const urlLower = key.url.toLowerCase();
                if (urlLower.includes(modelIdLower)) {
                    const response = await cache.match(key);
                    if (response) {
                        const blob = await response.blob();
                        totalBytes += blob.size;
                    }
                }
            }

            // Also check if there's a standalone cache just for this model ID
            try {
                const hasLegacy = await caches.has('webllm/' + modelId);
                if (hasLegacy) {
                    const legacyCache = await caches.open('webllm/' + modelId);
                    const legacyKeys = await legacyCache.keys();
                    for (const key of legacyKeys) {
                        const response = await legacyCache.match(key);
                        if (response) {
                            const blob = await response.blob();
                            totalBytes += blob.size;
                        }
                    }
                }
            } catch (_) { }

            if (totalBytes === 0) return '0 MB';
            if (totalBytes < 1024 * 1024) {
                return (totalBytes / 1024).toFixed(1) + ' KB';
            } else if (totalBytes < 1024 * 1024 * 1024) {
                return (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
            } else {
                return (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
            }
        } catch (e) {
            console.warn(`[WebLlmCacheManager] Failed to read size for ${modelId}:`, e);
            return 'Unknown';
        }
    }

    /**
     * Get the download completion percentage of a WebLLM model
     * @param {string} modelId Model ID
     * @returns {Promise<number>} Percentage (0-100)
     */
    static async getCacheCompletion(modelId) {
        if (typeof caches === 'undefined') return 0;
        try {
            const modelIdLower = modelId.toLowerCase();
            let data = null;
            let keysToCount = [];

            // 1. Try to find ndarray-cache.json in the webllm/config cache
            if (await caches.has('webllm/config')) {
                const configCache = await caches.open('webllm/config');
                const configKeys = await configCache.keys();
                const configKey = configKeys.find(k => {
                    const urlLower = k.url.toLowerCase();
                    return urlLower.includes(modelIdLower) && urlLower.endsWith('ndarray-cache.json');
                });
                if (configKey) {
                    const response = await configCache.match(configKey);
                    if (response) {
                        data = await response.json();
                    }
                }
            }

            // 2. Try to find ndarray-cache.json in the webllm/model cache
            const modelCache = await caches.open('webllm/model');
            const modelKeys = await modelCache.keys();
            keysToCount = modelKeys;

            if (!data) {
                const configKey = modelKeys.find(k => {
                    const urlLower = k.url.toLowerCase();
                    return urlLower.includes(modelIdLower) && urlLower.endsWith('ndarray-cache.json');
                });
                if (configKey) {
                    const response = await modelCache.match(configKey);
                    if (response) {
                        data = await response.json();
                    }
                }
            }

            // 3. Legacy individual cache check
            if (!data) {
                try {
                    const hasLegacy = await caches.has('webllm/' + modelId);
                    if (hasLegacy) {
                        const legacyCache = await caches.open('webllm/' + modelId);
                        const legacyKeys = await legacyCache.keys();
                        const legacyConfigKey = legacyKeys.find(k => k.url.endsWith('ndarray-cache.json'));
                        if (legacyConfigKey) {
                            const response = await legacyCache.match(legacyConfigKey);
                            if (response) {
                                data = await response.json();
                                keysToCount = legacyKeys;
                            }
                        }
                    }
                } catch (_) { }
            }

            if (!data || !Array.isArray(data.records)) {
                // Fallback: If we find files for this model but no config manifest, count files
                const matchingFiles = keysToCount.filter(k => {
                    const urlLower = k.url.toLowerCase();
                    return urlLower.includes(modelIdLower);
                });
                return matchingFiles.length > 5 ? 100 : 0;
            }

            const expectedShards = new Set();
            data.records.forEach(r => {
                if (r.dataPath) expectedShards.add(r.dataPath);
            });

            if (expectedShards.size === 0) return 100;

            let cachedCount = 0;
            const cachedUrls = keysToCount.map(k => k.url);

            expectedShards.forEach(shard => {
                if (cachedUrls.some(url => url.toLowerCase().includes(modelIdLower) && url.endsWith(shard))) {
                    cachedCount++;
                }
            });

            return Math.round((cachedCount / expectedShards.size) * 100);
        } catch (e) {
            console.warn(`[WebLlmCacheManager] Failed to calculate completion for ${modelId}:`, e);
            return 0;
        }
    }

    /**
     * Delete a specific model from the cache
     * @param {string} modelId Model ID
     * @returns {Promise<boolean>} True if deleted successfully
     */
    static async deleteCachedModel(modelId) {
        if (typeof caches === 'undefined') return false;
        try {
            console.log(`[WebLlmCacheManager] Deleting model files for: ${modelId}`);

            // Delete from the shared webllm/model cache
            const cache = await caches.open('webllm/model');
            const keys = await cache.keys();
            const modelIdLower = modelId.toLowerCase();
            let deletedAny = false;

            for (const key of keys) {
                const urlLower = key.url.toLowerCase();
                if (urlLower.includes(modelIdLower)) {
                    await cache.delete(key);
                    deletedAny = true;
                }
            }

            // Also delete legacy standalone cache if it exists
            const legacyDeleted = await caches.delete('webllm/' + modelId);

            return deletedAny || legacyDeleted;
        } catch (e) {
            console.error(`[WebLlmCacheManager] Failed to delete cache for ${modelId}:`, e);
            return false;
        }
    }

    /**
     * Map a cache name / model ID to its friendly display name
     * @param {string} modelId The model ID
     * @returns {string} Friendly name
     */
    static getModelFriendlyName(modelId) {
        const id = modelId.replace('webllm/', '');
        const found = this.MODELS.find(m => m.id === id);
        return found ? found.name : id;
    }
}
