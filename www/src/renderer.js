/**
 * Renderer Process Entry Point
 * Orchestrates event bindings and invokes sub-controllers
 */

// Bind actions to DOM elements
if (window.btnPlay) btnPlay.onclick = () => playCards();
if (window.btnPass) btnPass.onclick = () => passTurn();
if (window.btnShout) btnShout.onclick = () => shoutLa();

if (window.btnNew) {
    btnNew.onclick = () => {
        if (!gameState.gameEnded && gameState.players[0].length > 0) {
            showConfirm(t('confirmNewGame'), () => {
                initGame();
            });
        } else {
            initGame();
        }
    };
}

if (window.langToggle) {
    langToggle.onclick = () => {
        window.currentLang = currentLang === 'en' ? 'zh' : 'en';
        updateLanguage();
    };
}

if (window.infoIcon) {
    infoIcon.onclick = () => {
        if (rulesModal) rulesModal.classList.remove('hidden');
    };
}



async function loadNpcCacheList() {
    const tabManage = document.getElementById('tab-manage');
    if (!tabManage || !tabManage.classList.contains('active')) {
        return;
    }
    if (typeof WebLlmCacheView !== 'undefined') {
        WebLlmCacheView.renderCacheList();
    } else {
        try {
            const { WebLlmCacheView: View } = await import('./views/WebLlmCacheView.js');
            if (View) {
                View.renderCacheList();
            }
        } catch (err) {
            console.error('[Renderer] Failed to load WebLlmCacheView:', err);
        }
    }
}
window.loadNpcCacheList = loadNpcCacheList;

window.isNpcPreloaderActive = () => {
    return typeof WebLlmCacheManager !== 'undefined' && WebLlmCacheManager.isDownloading() && !WebLlmCacheManager.isPaused();
};

// Initial orchestration run
setupAvatarClickListeners();
updateLanguage();
initGame();

// Dynamically initialize AISummaryController
import('./controllers/AISummaryController.js').then(({ AISummaryController }) => {
    window.AISummary = new AISummaryController();
    if (typeof window.AISummary.updateLanguage === 'function') {
        window.AISummary.updateLanguage();
    }
}).catch(err => {
    console.error('[Renderer] Failed to initialize AISummaryController:', err);
});
