/**
 * AiServiceFactory - 負責偵測 WebGPU 相容性並建立/切換 AI 服務的工廠模組
 */

import { LmStudioAiService } from './LmStudioAiService.js';
import { WebLlmAiService } from './WebLlmAiService.js';

// 全域快取的服務實例
const cachedWebLlmServices = new Map();
let cachedLmStudioService = null;
let lastLmStudioSettingsKey = '';

export class AiServiceFactory {
    /**
     * 檢查當前瀏覽器環境是否支援 WebGPU
     * @returns {boolean} 是否支援 WebGPU
     */
    static isWebGpuSupported() {
        return typeof navigator !== 'undefined' && !!navigator.gpu;
    }

    /**
     * 根據設定與硬體環境建立或取得快取的 AI 服務實例
     * @param {Object} options 設定選項
     * @param {boolean} options.useLocalWebGPU 是否偏好使用本地 WebGPU (WebLLM)
     * @param {string} [options.modelId] 模型名稱 (例如 Qwen2.5-1.5B-Instruct-q4f32_1-MLC)
     * @param {string} [options.apiUrl] LM Studio API 網址 (當 useLocalWebGPU 為 false 或降級時使用)
     * @param {string} [options.apiKey] LM Studio API 金鑰
     * @param {string} [options.workerPath] Web Worker 檔案路徑
     * @param {Function} [options.initProgressCallback] 模型下載與載入進度回呼
     * @returns {LmStudioAiService|WebLlmAiService} 實作了 fetchAiMove 介面的 AI 服務實例
     */
    static createService(options = {}) {
        const {
            useLocalWebGPU = false,
            modelId,
            apiUrl,
            apiKey,
            workerPath = './aiWorker.js',
            initProgressCallback
        } = options;

        if (useLocalWebGPU) {
            if (this.isWebGpuSupported()) {
                const actualModelId = modelId || 'gemma-2-2b-it-q4f16_1-MLC';
                const settingsKey = `${actualModelId}`;

                let serviceInstance = cachedWebLlmServices.get(settingsKey);

                if (serviceInstance) {
                    console.log(`%c[AiServiceFactory] 複用快取的 WebLlmAiService 實例: ${settingsKey}`, 'color: #2ecc71; font-weight: bold;');
                    if (initProgressCallback) {
                        serviceInstance.addProgressListener(initProgressCallback);
                    }
                    return serviceInstance;
                }

                console.log(`%c[AiServiceFactory] 建立新的 WebLlmAiService: ${settingsKey}...`, 'color: #2ecc71; font-weight: bold;');
                
                // 釋放其他已載入至 GPU 的模型 VRAM，但「不要」影響正在下載的模型
                for (const [key, svc] of cachedWebLlmServices.entries()) {
                    if (svc.isReady && svc.engine) {
                        try {
                            console.log(`[AiServiceFactory] 釋放其他模型的 VRAM 以避免記憶體衝突: ${key}`);
                            svc.engine.unload();
                            svc.isReady = false;
                        } catch (e) {}
                    }
                }

                serviceInstance = new WebLlmAiService({
                    modelId: actualModelId,
                    workerPath,
                    initProgressCallback
                });
                cachedWebLlmServices.set(settingsKey, serviceInstance);
                return serviceInstance;
            } else {
                console.warn(
                    '[AiServiceFactory] 使用者要求使用本地 WebGPU，但此瀏覽器或系統不支援 WebGPU。\n' +
                    '系統將自動安全降級使用 LmStudio 遠端/本機服務。'
                );
                // 自動降級回 LmStudioAiService 並走快取
                const actualModelId = modelId || 'local-model';
                const activeApiUrl = apiUrl || 'http://localhost:1234/v1/chat/completions';
                const settingsKey = `${activeApiUrl}_${actualModelId}_${apiKey || ''}`;

                if (cachedLmStudioService && lastLmStudioSettingsKey === settingsKey) {
                    return cachedLmStudioService;
                }

                cachedLmStudioService = new LmStudioAiService({
                    apiUrl: activeApiUrl,
                    modelId: actualModelId,
                    apiKey
                });
                lastLmStudioSettingsKey = settingsKey;
                return cachedLmStudioService;
            }
        }

        // LM Studio 快取服務
        const actualModelId = modelId || 'local-model';
        const activeApiUrl = apiUrl || 'http://localhost:1234/v1/chat/completions';
        const settingsKey = `${activeApiUrl}_${actualModelId}_${apiKey || ''}`;

        if (cachedLmStudioService && lastLmStudioSettingsKey === settingsKey) {
            console.log('[AiServiceFactory] 複用快取的 LmStudioAiService 實例');
            return cachedLmStudioService;
        }

        console.log('[AiServiceFactory] 建立新的 LmStudioAiService...');
        cachedLmStudioService = new LmStudioAiService({
            apiUrl: activeApiUrl,
            modelId: actualModelId,
            apiKey
        });
        lastLmStudioSettingsKey = settingsKey;
        return cachedLmStudioService;
    }
}
