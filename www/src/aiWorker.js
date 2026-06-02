/**
 * aiWorker.js - WebLLM 專用 Web Worker 獨立腳本
 * 使用標準 WebWorkerLoopService 來處理背景推論，避免阻塞 UI。
 */

// 從 CDN 引入 @mlc-ai/web-llm
import { WebWorkerMLCEngineHandler } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm";

// 初始化 Worker 服務處理器
const handler = new WebWorkerMLCEngineHandler();

// 接聽來自 WebLlmAiService 的事件並交給 WebWorkerMLCEngineHandler 處理
self.onmessage = (event) => {
  handler.onmessage(event);
};
