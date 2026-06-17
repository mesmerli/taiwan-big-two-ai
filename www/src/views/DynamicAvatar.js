/**
 * 橘貓表情雪碧圖配置 (Sprite Sheet Metadata)
 * 大圖尺寸 800 x 400，完美平鋪為 4 x 2 網格，每格單張貼圖為 200 x 200。
 * 
 * 索引與大圖中的網格座標對應關係：
 * Row 0: 0, 1, 2, 3
 * Row 1: 4, 5, 6, 7
 */
const stickersMetadata = [
    {
        index: 0,
        name: "絕望崩潰",
        description: "極度逆風、瀕臨落敗的絕望表情",
        xRange: [-1.0, -0.5],
        yRange: [0.5, 1.0],
        grid: { row: 0, col: 0 }
    },
    {
        index: 1,
        name: "無奈憋屈",
        description: "手牌普通但局勢稍微不利，感到無奈低調的表情",
        xRange: [-0.5, 0.0],
        yRange: [0.0, 0.5],
        grid: { row: 0, col: 1 }
    },
    {
        index: 2,
        name: "狂喜囂張",
        description: "極度順風、聽牌或即將獲勝的囂張大笑",
        xRange: [0.5, 1.0],
        yRange: [0.6, 1.0],
        grid: { row: 0, col: 2 }
    },
    {
        index: 3,
        name: "驚恐霹靂",
        description: "局勢不妙、被對手出大牌突襲時的驚恐表情",
        xRange: [-1.0, -0.3],
        yRange: [0.0, 0.5],
        grid: { row: 0, col: 3 }
    },
    {
        index: 4,
        name: "心機觀察",
        description: "局勢均勢，正在內斂算牌、暗中觀察的平靜心機表情",
        xRange: [-0.3, 0.3],
        yRange: [0.0, 0.4],
        grid: { row: 1, col: 0 }
    },
    {
        index: 5,
        name: "挑釁挖苦",
        description: "稍微順風，對其他玩家進行挖苦或挑釁的表情",
        xRange: [0.2, 0.6],
        yRange: [0.5, 0.9],
        grid: { row: 1, col: 1 }
    },
    {
        index: 6,
        name: "憤怒抓狂",
        description: "極度逆風且情緒張力高漲，憤怒拍桌抓狂的表情",
        xRange: [-1.0, -0.6],
        yRange: [0.7, 1.0],
        grid: { row: 1, col: 2 }
    },
    {
        index: 7,
        name: "期待祈禱",
        description: "中性偏順風，心懷期待、祈禱拿到好牌或對手放水的表情",
        xRange: [0.0, 0.5],
        yRange: [0.3, 0.7],
        grid: { row: 1, col: 3 }
    }
];

class DynamicAvatar {
    /**
     * @param {HTMLCanvasElement} canvas 目標 Canvas 節點
     * @param {string} spriteUrl 雪碧圖的圖片路徑
     * @param {Object} options 配置選項
     * @param {Function} options.onStateChange 當表情 index 改變時的回呼函式 (傳入最新 state 物件)
     * @param {Function} options.onTensionChange 當 Y 軸張力值改變時的回呼函式 (傳入 y 值)
     */
    constructor(canvas, spriteUrl, options = {}) {
        if (!canvas) throw new Error("必須提供有效的 HTMLCanvasElement 節點。");
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.spriteUrl = spriteUrl;
        
        // 回呼函數
        this.onStateChange = options.onStateChange || null;
        this.onTensionChange = options.onTensionChange || null;

        // 貼圖尺寸定義
        this.spriteWidth = 800;
        this.spriteHeight = 400;
        this.cols = 4;
        this.rows = 2;
        this.cellWidth = 200;
        this.cellHeight = 200;

        // 目前狀態
        this.currentX = 0;
        this.currentY = 0;
        this.currentIndex = -1; // 初始設為 -1 確保第一次渲染成功觸發
        
        // 載入雪碧圖 (加入隨機參數防止瀏覽器快取舊圖)
        this.isLoaded = false;
        this.spriteImage = new Image();
        this.spriteImage.src = spriteUrl + (spriteUrl.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
        this.spriteImage.onload = () => {
            this.isLoaded = true;
            // 動態根據載入的圖片真實尺寸，計算每格的寬高，確保任何解析度都能完美裁剪 4x2 網格
            this.cellWidth = this.spriteImage.width / this.cols;
            this.cellHeight = this.spriteImage.height / this.rows;
            // 載入完成後依據目前座標執行首次繪製
            this.draw();
        };
        this.spriteImage.onerror = (err) => {
            console.error("無法載入表情雪碧圖:", err);
        };
    }

    /**
     * 更新玩家心理狀態指標 (X, Y)
     * @param {number} x 局勢順逆值 (-1.0 至 1.0)
     * @param {number} y 互動張力值 (0.0 至 1.0)
     */
    updatePsychologicalState(x, y) {
        // 1. 數值範圍限制 (Clamping)
        const clampedX = Math.max(-1.0, Math.min(1.0, x));
        const clampedY = Math.max(0.0, Math.min(1.0, y));

        this.currentX = clampedX;
        this.currentY = clampedY;

        // 觸發張力改變回呼（供外部 UI 效果，如閃爍或震動使用）
        if (this.onTensionChange) {
            this.onTensionChange(clampedY);
        }

        // 2. 核心演算法：尋找符合的表情
        const matchedIndex = this.findMatchingStickerIndex(clampedX, clampedY);

        // 3. 效能優化 (重繪防手震)：只有在 index 改變時才重新繪製
        if (matchedIndex !== this.currentIndex) {
            this.currentIndex = matchedIndex;
            
            // 觸發表情改變回呼
            if (this.onStateChange) {
                const stateObj = stickersMetadata.find(s => s.index === matchedIndex);
                this.onStateChange(stateObj);
            }

            this.draw();
        }
    }

    /**
     * 核心演算法：尋找符合目前 (x, y) 的表情索引
     * @param {number} x 
     * @param {number} y 
     * @returns {number} 匹配到的表情 index
     */
    findMatchingStickerIndex(x, y) {
        // 找出所有區間包含 (x, y) 的候選表情
        const candidates = stickersMetadata.filter(sticker => {
            const inX = x >= sticker.xRange[0] && x <= sticker.xRange[1];
            const inY = y >= sticker.yRange[0] && y <= sticker.yRange[1];
            return inX && inY;
        });

        // 情況 A：若有唯一的匹配，直接回傳
        if (candidates.length === 1) {
            return candidates[0].index;
        }

        // 情況 B：若同時符合多張（邊界重疊），以「張力 Y 軸中點距離較近者」優先
        if (candidates.length > 1) {
            let bestCandidate = candidates[0];
            let minDistance = Infinity;

            candidates.forEach(cand => {
                const yMidpoint = (cand.yRange[0] + cand.yRange[1]) / 2;
                const dist = Math.abs(y - yMidpoint);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestCandidate = cand;
                }
            });
            return bestCandidate.index;
        }

        // 情況 C：若沒有任何表情完全符合 (邊界外或空隙)，則尋找距離最近的表情
        // 計算 (x, y) 到各表情中心點的 2D 歐幾里得距離
        let closestSticker = stickersMetadata[4]; // 預設為心機觀察 (index: 4)
        let minDistance = Infinity;

        stickersMetadata.forEach(sticker => {
            const xMid = (sticker.xRange[0] + sticker.xRange[1]) / 2;
            const yMid = (sticker.yRange[0] + sticker.yRange[1]) / 2;
            const dist = Math.sqrt(Math.pow(x - xMid, 2) + Math.pow(y - yMid, 2));
            if (dist < minDistance) {
                minDistance = dist;
                closestSticker = sticker;
            }
        });

        return closestSticker.index;
    }

    /**
     * 執行畫布裁切與繪製
     */
    draw() {
        if (!this.isLoaded || this.currentIndex === -1) return;

        const sticker = stickersMetadata.find(s => s.index === this.currentIndex);
        if (!sticker) return;

        const { row, col } = sticker.grid;

        // 計算在大圖中的像素座標
        const sx = col * this.cellWidth;
        const sy = row * this.cellHeight;

        // 清除畫布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 使用平滑渲染模式
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = "high";

        // 將頭像完美地填滿 Canvas (支援內部縮放)
        this.ctx.drawImage(
            this.spriteImage,
            sx, sy, this.cellWidth, this.cellHeight, // 來源裁切區
            0, 0, this.canvas.width, this.canvas.height // 目標繪製區
        );
    }

    /**
     * 導出當前單張頭像為 Base64 字串
     * @returns {string} Base64 PNG 圖片資料 URL
     */
    exportCurrentAvatar() {
        return this.canvas.toDataURL("image/png");
    }
}

// 支援瀏覽器全域載入與 ES6 模組匯出
if (typeof module !== "undefined" && module.exports) {
    module.exports = { DynamicAvatar, stickersMetadata };
} else {
    window.DynamicAvatar = DynamicAvatar;
    window.stickersMetadata = stickersMetadata;
}
