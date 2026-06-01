const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetDir = path.join(__dirname, '..', 'dist', 'tauri-store-unpacked');
const releaseDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release');

// 1. 確保輸出目錄乾淨
if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// 2. 尋找編譯出的 exe 檔
// 依據 Rust Cargo.toml，編譯出來的檔案名稱是 "app.exe"
const sourceExe = path.join(releaseDir, 'app.exe');
const destExeName = 'taiwan-big-two-ai-store.exe'; // 封裝至 MSIX 時重新命名為與 tauri.store.conf.json 相同的名稱

if (!fs.existsSync(sourceExe)) {
    console.error(`[MSIX] 找不到編譯出的執行檔: ${sourceExe}`);
    console.error(`請確認是否已成功執行建置。`);
    process.exit(1);
}

// 3. 複製執行檔到打包目錄
const destExe = path.join(targetDir, destExeName);
fs.copyFileSync(sourceExe, destExe);
console.log(`[MSIX] 已將執行檔複製到打包目錄: ${destExe}`);

// 4. 呼叫 winappcli 進行 MSIX 打包
console.log(`[MSIX] 開始執行 winapp pack 打包...`);
try {
    // 呼叫 winappcli 打包剛剛準備好乾淨執行檔的目錄
    execSync('npx winapp pack ./dist/tauri-store-unpacked', { stdio: 'inherit' });
    console.log(`[MSIX] MSIX 打包完成！`);

    // 5. 尋找根目錄產生的 .msix 並移動到專屬資料夾
    const rootDir = path.join(__dirname, '..');
    const outputDir = path.join(__dirname, '..', 'dist', 'tauri-store-msix');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = fs.readdirSync(rootDir);
    const msixFiles = files.filter(f => f.endsWith('.msix'));

    for (const file of msixFiles) {
        const srcPath = path.join(rootDir, file);
        const destPath = path.join(outputDir, file);
        
        // 移到專屬資料夾
        fs.renameSync(srcPath, destPath);
        console.log(`[MSIX] 已將包裝好的 MSIX 移動至專用資料夾: ${destPath}`);
    }
} catch (err) {
    console.error(`[MSIX] 打包失敗:`, err);
    process.exit(1);
}
