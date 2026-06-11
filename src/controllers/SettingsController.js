// Translation helper
function t(key, params = {}) {
    let str = I18N[currentLang][key] || key;
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
    }
    return str;
}
window.t = t;

function updateRulesDescription() {
    const ruleMode = AppStorage.getItem('ruleMode') || 'taiwan';
    const suffix = ruleMode === 'taiwan' ? 'TW' : 'HK';

    const elements = {
        'rule-desc-suit': 'ruleSuit',
        'rule-desc-start': 'ruleStart',
        'rule-desc-dragon': 'ruleDragon',
        'rule-desc-fivecard': 'ruleFiveCard',
        'rule-desc-bombs': 'ruleBombs',
        'rule-desc-basescore': 'ruleBaseScore',
        'rule-desc-winner2': 'ruleWinner2',
        'rule-desc-winner4': 'ruleWinner4',
        'rule-desc-loser10': 'ruleLoser10',
        'rule-desc-loserTwo': 'ruleLoserTwo',
        'rule-desc-loserSpecial': 'ruleLoserSpecial'
    };

    for (const [id, keyPrefix] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
            const key = keyPrefix + suffix;
            el.innerHTML = t(key);
        }
    }
}
window.updateRulesDescription = updateRulesDescription;

function updateLanguage() {
    window.currentLang = currentLang;
    updateRulesDescription();

    if (typeof LicenseService !== 'undefined') {
        const licenseStatus = LicenseService.getLicenseStatusSync();
        if (licenseStatus && licenseStatus.isActive) {
            if (licenseStatus.isTrial) {
                window.trialDaysRemaining = licenseStatus.trialDaysRemaining;
            } else {
                window.trialDaysRemaining = null;
            }
        }
    }
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N[currentLang][key]) {
            el.textContent = I18N[currentLang][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (I18N[currentLang][key]) {
            el.placeholder = I18N[currentLang][key];
        }
    });

    const buildTarget = typeof LicenseService !== 'undefined' ? LicenseService.getBuildTarget() : (ipcRenderer ? ipcRenderer.sendSync('get-build-target') : 'GITHUB');
    
    const tabLicenseBtn = document.querySelector('[data-i18n="tabLicense"]');
    if (tabLicenseBtn) {
        if (buildTarget === 'STORE') {
            tabLicenseBtn.textContent = I18N[currentLang].tabLicenseStore || I18N['en'].tabLicenseStore;
        } else {
            tabLicenseBtn.textContent = I18N[currentLang].tabLicense || I18N['en'].tabLicense;
        }
    }

    const licenseSponsorTextElement = document.getElementById('license-sponsor-text-element');
    if (licenseSponsorTextElement) {
        if (buildTarget === 'STORE') {
            licenseSponsorTextElement.innerHTML = I18N[currentLang].rulesSourceStore || I18N['en'].rulesSourceStore;
        } else {
            licenseSponsorTextElement.innerHTML = I18N[currentLang].rulesSourceSponsor || I18N['en'].rulesSourceSponsor;
        }
        
        const rulesGhLink = document.getElementById('rules-github-link');
        const rulesSpLink = document.getElementById('rules-sponsor-link');
        const openLink = (url) => {
            if (typeof SystemService !== 'undefined') {
                SystemService.openExternal(url);
            } else if (typeof require !== 'undefined' && ipcRenderer) {
                try {
                    const { shell } = require('electron');
                    shell.openExternal(url);
                } catch (e) {
                    window.open(url, '_blank');
                }
            } else {
                window.open(url, '_blank');
            }
        };

        if (rulesGhLink) {
            rulesGhLink.onclick = (e) => {
                e.preventDefault();
                openLink('https://github.com/mesmerli/taiwan-big-two-ai');
            };
        }
        if (rulesSpLink) {
            rulesSpLink.onclick = (e) => {
                e.preventDefault();
                openLink('https://ko-fi.com/mesmerli');
            };
        }
    }

    const licenseStoreStatus = document.getElementById('license-store-status');
    if (licenseStoreStatus) {
        if (buildTarget === 'STORE') {
            const licenseStatus = typeof LicenseService !== 'undefined' ? LicenseService.getLicenseStatusSync() : (ipcRenderer ? ipcRenderer.sendSync('get-license-status-sync') : null);
            if (!licenseStatus || !licenseStatus.isActive) {
                licenseStoreStatus.textContent = t('storeCheckingLicense');
                licenseStoreStatus.style.color = '#94a3b8';
                licenseStoreStatus.style.cursor = 'default';
                licenseStoreStatus.style.textDecoration = 'none';
                licenseStoreStatus.title = '';
            } else if (licenseStatus.isTrial) {
                const daysLeft = licenseStatus.trialDaysRemaining !== undefined ? licenseStatus.trialDaysRemaining : (() => {
                    const now = new Date();
                    const expirationDate = new Date(licenseStatus.expirationDate);
                    return Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
                })();
                licenseStoreStatus.textContent = t('trialDaysLeft', { days: daysLeft });
                licenseStoreStatus.style.color = '#f39c12';
                licenseStoreStatus.style.cursor = 'pointer';
                licenseStoreStatus.style.textDecoration = 'underline';
                licenseStoreStatus.title = t('trialClickToBuy');
            } else {
                licenseStoreStatus.textContent = t('storeFullVersion');
                licenseStoreStatus.style.color = '#10b981';
                licenseStoreStatus.style.cursor = 'default';
                licenseStoreStatus.style.textDecoration = 'none';
                licenseStoreStatus.title = '';
            }
        } else if (ipcRenderer) {
            licenseStoreStatus.textContent = t('githubVersionWarning');
            licenseStoreStatus.style.color = '#ef4444';
            licenseStoreStatus.style.cursor = 'default';
            licenseStoreStatus.style.textDecoration = 'none';
            licenseStoreStatus.title = '';
        } else {
            licenseStoreStatus.textContent = '';
            licenseStoreStatus.style.cursor = 'default';
            licenseStoreStatus.style.textDecoration = 'none';
            licenseStoreStatus.title = '';
        }
    }

    // Update Rules Footer (Version & Author)
    let pkg = window.AppVersionInfo || { version: "1.5.0", author: "mesmerli", buildVersion: "1.5.0.0" };
    if (typeof require !== 'undefined' && !window.AppVersionInfo) {
        try {
            pkg = require('./package.json');
        } catch (e) {
            console.warn('[Renderer] package.json require failed, using fallbacks.');
        }
    }
    const rulesVersion = document.getElementById('rules-version');
    const rulesAuthor = document.getElementById('rules-author');
    if (rulesVersion) rulesVersion.textContent = `v${pkg.buildVersion || pkg.version}`;
    if (rulesAuthor) rulesAuthor.textContent = `${t('author')}: ${pkg.author || 'mesmerli'}`;

    // Dynamic Character Name Sync
    const names = currentLang === 'zh' ? PLAYER_NAMES_ZH : PLAYER_NAMES_EN;
    window.PLAYER_NAMES = [...names];

    if (window.AI && typeof window.AI.getNames === 'function') {
        const aiData = window.AI.getNames();
        for (let i = 0; i <= 3; i++) {
            const playerEl = document.getElementById(i === 0 ? 'human-area' : `player-${i + 1}`);
            if (!playerEl) continue;

            if (aiData[i]) {
                const data = aiData[i];
                let suffix = '';
                if (data.isLLM) {
                    suffix = ' (AI)';
                } else {
                    suffix = t('npcSuffix');
                }

                PLAYER_NAMES[i] = data.name + suffix;

                const avatarEl = playerEl.querySelector('.avatar');
                if (avatarEl) {
                    if (data.name === "橘貓" || data.name === "OrangeCat" || data.isDynamic) {
                        const canvasId = `canvas-avatar-${i}`;
                        let canvasEl = document.getElementById(canvasId);
                        if (!canvasEl) {
                            avatarEl.innerHTML = `<canvas id="${canvasId}" width="100" height="100" style="width: 100%; height: 100%; border-radius: 50%; display: block;"></canvas>`;
                            canvasEl = document.getElementById(canvasId);
                        }
                        
                        // Initialize DynamicAvatar if not exists, or update if the image changed
                        if (!window.activeDynamicAvatars) window.activeDynamicAvatars = {};
                        const hasInstance = !!window.activeDynamicAvatars[i];
                        const urlChanged = hasInstance && window.activeDynamicAvatars[i].spriteUrl !== data.avatar;
                        
                        if (!hasInstance || urlChanged) {
                            window.activeDynamicAvatars[i] = new DynamicAvatar(canvasEl, data.avatar, {
                                onTensionChange: (y) => {
                                    if (y > 0.8) {
                                        playerEl.classList.add('tension-high');
                                    } else {
                                        playerEl.classList.remove('tension-high');
                                    }
                                }
                            });
                        }
                    } else {
                        // Cleanup dynamic avatar if swapped away
                        if (window.activeDynamicAvatars && window.activeDynamicAvatars[i]) {
                            delete window.activeDynamicAvatars[i];
                            playerEl.classList.remove('tension-high');
                        }
                        if (data.avatar && data.avatar.includes('src/assets/avatars/')) {
                            avatarEl.innerHTML = `<img src="${data.avatar}" alt="${data.name}">`;
                        } else {
                            avatarEl.textContent = data.avatar;
                        }
                    }
                    if (data.isLLM) avatarEl.classList.add('llm-glow');
                    else avatarEl.classList.remove('llm-glow');
                }

                const gearIcon = playerEl.querySelector('.settings-icon');
                if (gearIcon) {
                    if (data.isLLM) gearIcon.classList.remove('hidden');
                    else gearIcon.classList.add('hidden');
                }
            } else {
                PLAYER_NAMES[i] = t('youName');
                const avatarEl = playerEl.querySelector('.avatar');
                if (avatarEl) {
                    const canvasId = `canvas-avatar-0`;
                    let canvasEl = document.getElementById(canvasId);
                    if (!canvasEl) {
                        avatarEl.innerHTML = `<canvas id="${canvasId}" width="100" height="100" style="width: 100%; height: 100%; border-radius: 50%; display: block;"></canvas>`;
                        canvasEl = document.getElementById(canvasId);
                    }
                    
                    // Initialize human dynamic avatar (Panda)
                    if (!window.activeDynamicAvatars) window.activeDynamicAvatars = {};
                    if (!window.activeDynamicAvatars[0]) {
                        window.activeDynamicAvatars[0] = new DynamicAvatar(canvasEl, "src/assets/avatars/panda_sprite.png", {
                            onTensionChange: (y) => {
                                if (y > 0.8) {
                                    playerEl.classList.add('tension-high');
                                } else {
                                    playerEl.classList.remove('tension-high');
                                }
                            }
                        });
                    }
                    avatarEl.classList.remove('llm-glow');
                }
                const gearIcon = playerEl.querySelector('.settings-icon');
                if (gearIcon) gearIcon.classList.add('hidden');
            }
        }
    }

    document.title = t('title');
    if (ipcRenderer) {
        ipcRenderer.send('update-lang', currentLang);
    }
    
    // Sync Tauri Windows Jump List language
    const isTauriEnv = typeof AppEnv !== 'undefined' ? AppEnv.isTauri : 
                         (typeof window !== 'undefined' && 
                          (window.__TAURI_METADATA__ !== undefined || 
                           window.__TAURI__ !== undefined || 
                           window.__TAURI_INTERNALS__ !== undefined));
    if (isTauriEnv && typeof window !== 'undefined' && window.__TAURI__) {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.invoke;
        if (typeof invoke === 'function') {
            invoke('update_jump_list', { lang: currentLang }).catch(err => {
                console.error("[Tauri] Failed to update jump list:", err);
            });
        }
    }

    updateMuteUI();
    updateTrialStatusUI();
    renderAll();
    
    if (window.AISummary && typeof window.AISummary.updateLanguage === 'function') {
        window.AISummary.updateLanguage();
    }
}
window.updateLanguage = updateLanguage;

function updateTrialStatusUI() {
    if (!trialStatus || trialDaysRemaining === null) return;
    trialStatus.textContent = t('trialDaysLeft', { days: trialDaysRemaining });
    trialStatus.title = t('trialClickToBuy');
    trialStatus.classList.remove('hidden');
}
window.updateTrialStatusUI = updateTrialStatusUI;

const openStore = () => {
    if (typeof LicenseService !== 'undefined') {
        LicenseService.openStore();
    } else if (ipcRenderer) {
        ipcRenderer.send('open-store');
    } else if (typeof SystemService !== 'undefined') {
        SystemService.openExternal('ms-windows-store://pdp/?ProductId=9PM1S8GKBLK9');
    }
};

if (trialStatus) {
    trialStatus.addEventListener('click', openStore);
}

const licenseStoreStatus = document.getElementById('license-store-status');
if (licenseStoreStatus) {
    licenseStoreStatus.addEventListener('click', () => {
        const buildTarget = typeof LicenseService !== 'undefined' ? LicenseService.getBuildTarget() : (ipcRenderer ? ipcRenderer.sendSync('get-build-target') : 'GITHUB');
        if (buildTarget === 'STORE') {
            const licenseStatus = typeof LicenseService !== 'undefined' ? LicenseService.getLicenseStatusSync() : (ipcRenderer ? ipcRenderer.sendSync('get-license-status-sync') : null);
            if (licenseStatus && licenseStatus.isTrial) {
                openStore();
            }
        }
    });
}

if (ipcRenderer) {
    ipcRenderer.on('license-status', (event, status) => {
        if (status.isTrial) {
            window.trialDaysRemaining = status.daysLeft;
        } else if (status.isFullVersion) {
            window.trialDaysRemaining = null;
        }
        updateLanguage();
    });
}

function updateMuteUI() {
    if (!muteToggle) return;

    let icon = '🔊';
    let tooltip = t('soundModeAll');

    if (soundMode === 1) {
        icon = '🔉';
        tooltip = t('soundModeSFX');
    } else if (soundMode === 2) {
        icon = '🔇';
        tooltip = t('soundModeNone');
    }

    muteToggle.textContent = icon;
    muteToggle.title = tooltip;
    AudioPlayer.setSoundMode(soundMode);
}
window.updateMuteUI = updateMuteUI;

if (muteToggle) {
    muteToggle.onclick = () => {
        window.soundMode = (soundMode + 1) % 3;
        AppStorage.setItem('soundMode', soundMode);
        updateMuteUI();
    };
    updateMuteUI();
    AudioPlayer.playBGM();
}

const gameRuleModeInput = document.getElementById('game-rule-mode');
if (gameRuleModeInput) {
    const savedRuleMode = AppStorage.getItem('ruleMode') || 'taiwan';
    gameRuleModeInput.value = savedRuleMode;
    gameRuleModeInput.onchange = () => {
        const val = gameRuleModeInput.value;
        AppStorage.setItem('ruleMode', val);
        if (typeof updateRulesDescription === 'function') {
            updateRulesDescription();
        }
        if (typeof renderAll === 'function') {
            renderAll();
        }
    };
}

window.currentEditingIndex = -1;

function setupAvatarClickListeners() {
    const settingsModal = document.getElementById('ai-settings-modal');
    const apiUrlInput = document.getElementById('ai-api-url');
    const modelIdInput = document.getElementById('ai-model-id');
    const extraPromptInput = document.getElementById('ai-extra-prompt');
    const resetBtn = document.getElementById('ai-settings-reset');
    const clearLearningsBtn = document.getElementById('ai-clear-learnings');
    const learningsContainer = document.getElementById('ai-learnings-container');

    function updateLearningsUI(char) {
        if (!learningsContainer) return;
        learningsContainer.innerHTML = '';
        const learnings = char.learnings || [];
        if (learnings.length > 0) {
            learnings.forEach(item => {
                const div = document.createElement('div');
                div.className = 'learning-item';

                const tipText = typeof item === 'string' ? item : item.tip;
                const priority = typeof item === 'string' ? 'P1' : (item.priority || 'P1');
                const count = typeof item === 'string' ? 1 : (item.count || 1);

                div.innerHTML = `
                    <div class="learning-header">
                        <span class="badge ${priority.toLowerCase()}">${priority}</span>
                        <span class="count-badge">x${count}</span>
                    </div>
                    <div class="learning-text">${tipText}</div>
                `;
                learningsContainer.appendChild(div);
            });
        } else {
            const div = document.createElement('div');
            div.className = 'learning-empty';
            div.textContent = t('noLearningsYet');
            learningsContainer.appendChild(div);
        }
    }

    for (let i = 0; i <= 3; i++) {
        const playerEl = document.getElementById(i === 0 ? 'human-area' : `player-${i + 1}`);
        if (!playerEl) continue;

        const avatarEl = playerEl.querySelector('.avatar');
        const gearIcon = playerEl.querySelector('.settings-icon');

        if (avatarEl) {
            avatarEl.style.cursor = 'pointer';
            avatarEl.title = "Left click: Swap";

            avatarEl.onclick = (e) => {
                if (window.AI && typeof window.AI.swapCharacter === 'function') {
                    const newChar = window.AI.swapCharacter(i);
                    if (newChar) {
                        avatarEl.style.transform = 'scale(1.2)';
                        setTimeout(() => { avatarEl.style.transform = ''; }, 200);
                        updateLanguage();
                        AudioPlayer.playCardSelect();

                        if (gameState.turn === i) {
                            if (aiTurnTimeout) clearTimeout(aiTurnTimeout);
                            if (newChar.type !== "Human") {
                                updatePlayButtonVisibility();
                                updateStatus();
                                window.aiTurnTimeout = setTimeout(aiTurn, 500);
                            } else {
                                updateStatus();
                                updatePlayButtonVisibility();
                            }
                        }
                    }
                }
            };
            avatarEl.oncontextmenu = null;
        }

        if (gearIcon) {
            gearIcon.onclick = async (e) => {
                e.stopPropagation();
                if (!window.AI) return;

                const char = window.AI.getCharacter(i);
                if (char && char.isLLM) {
                    window.currentEditingIndex = i;
                    const settings = char.getSettings();
                    apiUrlInput.value = settings.apiUrl || '';
                    const apiKeyInput = document.getElementById('ai-api-key');
                    if (apiKeyInput) {
                        apiKeyInput.value = settings.apiKey || '';
                    }
                    const useWebGpuCheckbox = document.getElementById('ai-use-webgpu');
                    if (useWebGpuCheckbox) {
                        useWebGpuCheckbox.checked = AppStorage.getItem('useLocalWebGPU') === 'true';
                    }

                    extraPromptInput.value = settings.extraPrompt || '';
                    settingsModal.classList.remove('hidden');

                    fetchAvailableModels(apiUrlInput.value, settings.apiKey || '', settings.modelId || '');
                    updateLearningsUI(char);
                }
            };
        }
    }

    if (clearLearningsBtn) {
        clearLearningsBtn.onclick = () => {
            if (currentEditingIndex !== -1 && window.AI) {
                const char = window.AI.getCharacter(currentEditingIndex);
                if (char && char.isLLM) {
                    const msg = t('clearMemoryPrompt');
                    if (confirm(msg)) {
                        char.learnings = [];
                        if (typeof char.saveMemory === 'function') char.saveMemory();
                        updateLearningsUI(char);
                        AudioPlayer.playPass();
                    }
                }
            }
        };
    }

    const exportLearningsBtn = document.getElementById('ai-export-learnings');
    if (exportLearningsBtn) {
        exportLearningsBtn.onclick = async () => {
            if (currentEditingIndex !== -1 && window.AI) {
                const char = window.AI.getCharacter(currentEditingIndex);
                if (char && char.isLLM) {
                    const exportData = {
                        character: char.name,
                        timestamp: new Date().toISOString(),
                        learnings: char.learnings,
                        stats: char.stats
                    };

                    const defaultFilename = `${char.name}_Memory_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
                    
                    try {
                        const result = await window.SystemService.writeFile(defaultFilename, exportData);
                        if (result.success) {
                            AudioPlayer.playCardSelect();
                            console.log("[Export] Saved to: ", result.path || 'Web Download');
                        }
                    } catch (err) {
                        showAlert(t('exportFailed'));
                        console.error(err);
                    }
                }
            }
        };
    }

    const importLearningsBtn = document.getElementById('ai-import-learnings');
    if (importLearningsBtn) {
        importLearningsBtn.onclick = async () => {
            if (currentEditingIndex !== -1 && window.AI) {
                const char = window.AI.getCharacter(currentEditingIndex);
                if (char && char.isLLM) {
                    try {
                        const result = await window.SystemService.readFile({ accept: '.json' });
                        if (result.success && result.data) {
                            const data = result.data;
                            
                            if (Array.isArray(data.learnings)) {
                                char.learnings = data.learnings;
                                if (data.stats) char.stats = data.stats;
                                
                                if (typeof char.saveMemory === 'function') char.saveMemory();
                                
                                updateLearningsUI(char);
                                showAlert(t('importSuccess'));
                                AudioPlayer.playCardSelect();
                            } else {
                                throw new Error("Invalid format");
                            }
                        }
                    } catch (err) {
                        showAlert(t('importFailedFormat'));
                        console.error(err);
                    }
                }
            }
        };
    }

    let _modelFetchController = null;
    async function fetchAvailableModels(apiUrl, apiKey = '', savedModelId = '') {
        const useLocalWebGPU = AppStorage.getItem('useLocalWebGPU') === 'true';
        const modelList = document.getElementById('ai-model-id');
        if (!modelList) return;
        modelList.innerHTML = '';

        const statusEl = document.getElementById('ai-api-connection-status');

        if (useLocalWebGPU) {
            const { WebLlmCacheManager } = await import('../services/WebLlmCacheManager.js');
            const localModels = await WebLlmCacheManager.getFullyCachedStandardModels();

            if (localModels.length === 0) {
                if (statusEl) {
                    statusEl.textContent = t('builtInAiEngineActiveNeedsDownload');
                    statusEl.style.color = '#ef4444';
                }
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = t('noModelsDownloaded');
                modelList.appendChild(placeholder);
            } else {
                if (statusEl) {
                    statusEl.textContent = t('builtInAiEngineActive');
                    statusEl.style.color = '#10b981';
                }
                localModels.forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.id;
                    option.textContent = m.name;
                    modelList.appendChild(option);
                });
            }

            if (savedModelId && !localModels.some(m => m.id === savedModelId)) {
                const cachedList = await WebLlmCacheManager.listCachedModels();
                const isSavedCached = cachedList.some(c => c.toLowerCase() === savedModelId.toLowerCase());
                if (isSavedCached) {
                    const completion = await WebLlmCacheManager.getCacheCompletion(savedModelId);
                    if (completion === 100) {
                        const customOption = document.createElement('option');
                        customOption.value = savedModelId;
                        customOption.textContent = savedModelId;
                        modelList.appendChild(customOption);
                    }
                }
            }

            modelList.value = savedModelId || (localModels.length > 0 ? localModels[0].id : '');
            if (modelList.value !== savedModelId && modelList.value) {
                autoSave();
            }
            return;
        }

        if (_modelFetchController) {
            _modelFetchController.abort();
        }
        _modelFetchController = new AbortController();
        const controller = _modelFetchController;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = t('autoDetect');
        modelList.appendChild(defaultOption);

        if (!apiUrl) {
            modelList.value = savedModelId;
            return;
        }

        if (statusEl) {
            statusEl.textContent = t('connectionTesting');
            statusEl.style.color = '#f59e0b';
        }

        try {
            const urlObj = new URL(apiUrl);
            const modelsUrl = `${urlObj.protocol}//${urlObj.host}/v1/models`;

            console.log(`[UI] Fetching models from: ${modelsUrl}`);
            const headers = {};
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
            const response = await fetch(modelsUrl, { headers, signal: controller.signal });
            if (response.ok) {
                const data = await response.json();
                if (statusEl) {
                    statusEl.textContent = t('connectionSuccess');
                    statusEl.style.color = '#10b981';
                }

                if (modelList) {
                    const seen = new Set();
                    let hasSavedModel = false;
                    if (data && data.data) {
                        data.data.forEach((model) => {
                            const mId = model.id;
                            if (!mId || seen.has(mId)) return;
                            seen.add(mId);
                            if (mId === savedModelId) hasSavedModel = true;
                            const option = document.createElement('option');
                            option.value = mId;
                            option.textContent = mId;
                            modelList.appendChild(option);
                        });
                    }
                    if (savedModelId && !hasSavedModel) {
                        const customOption = document.createElement('option');
                        customOption.value = savedModelId;
                        customOption.textContent = savedModelId;
                        modelList.appendChild(customOption);
                    }
                    modelList.value = savedModelId;
                }
            } else {
                throw new Error('Response not OK');
            }
        } catch (e) {
            console.warn("[UI] Failed to fetch models for dropdown:", e);
            if (statusEl) {
                statusEl.textContent = t('connectionFailed');
                statusEl.style.color = '#ef4444';
            }
            if (modelList && savedModelId) {
                const customOption = document.createElement('option');
                customOption.value = savedModelId;
                customOption.textContent = savedModelId;
                modelList.appendChild(customOption);
                modelList.value = savedModelId;
            }
        }
    }
}
window.setupAvatarClickListeners = setupAvatarClickListeners;
