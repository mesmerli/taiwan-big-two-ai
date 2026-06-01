const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(__dirname, '..', 'www');

console.log('[Sync-WWW] 開始同步最新的網頁資源至 www/ 目錄...');

try {
    // 1. 清理舊的 www/src 目錄並重新建立
    const destSrc = path.join(dest, 'src');
    if (fs.existsSync(destSrc)) {
        fs.rmSync(destSrc, { recursive: true, force: true });
    }
    fs.mkdirSync(destSrc, { recursive: true });

    // 2. 複製主 HTML 與腳本
    const filesToCopy = ['index.html', 'about.html', 'aboutPreload.js'];
    for (const file of filesToCopy) {
        const srcFile = path.join(root, file);
        const destFile = path.join(dest, file);
        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, destFile);
        }
    }

    // 3. 遞迴複製 src 目錄到 www/src
    const srcFolder = path.join(root, 'src');
    if (fs.existsSync(srcFolder)) {
        fs.cpSync(srcFolder, destSrc, { recursive: true });
    }

    console.log('[Sync-WWW] 同步完成！');
} catch (err) {
    console.error('[Sync-WWW] 同步失敗:', err);
    process.exit(1);
}
