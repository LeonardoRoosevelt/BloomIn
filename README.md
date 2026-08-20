# BloomIn — 美術班簽到與計費

單機離線 PWA。所有資料只存在裝置本機的 IndexedDB，**不會傳送到任何伺服器**。

## 開發

```bash
pnpm install
pnpm dev --host      # 手機／平板可用同區網 IP 連進來測版面
pnpm build           # 產生 dist/
pnpm test            # 計費引擎測試
```

> `pnpm dev` 走 http，瀏覽器不允許註冊 Service Worker，因此開發模式**沒有離線能力**，這是預期行為。

## 部署

Service Worker 只能在 HTTPS 下註冊，所以必須把 `dist/` 靜態檔案放上一個 HTTPS 網址才能安裝成 App。
託管的只是程式碼，資料仍然 100% 留在裝置上。

推薦 Cloudflare Pages（免費、根目錄部署，`vite.config.ts` 的 `base` 已設為 `/`）：

- Build command: `pnpm build`
- Output directory: `dist`

若改用 GitHub Pages 專案頁，網址會多一層路徑，需把 `vite.config.ts` 的 `base` 改成 `'/BloomIn/'`，
並同步調整 manifest 的 `start_url` 與 `scope`。

## 安裝到 iPhone / iPad

1. 用 **Safari**（Chrome 不行）開啟部署後的網址
2. 分享 → **加入主畫面**
3. 從主畫面圖示啟動

## ⚠️ 資料保存

資料存在該網站的瀏覽器儲存區。**刪除主畫面圖示、或清除網站資料，學生與收費紀錄會一併消失且無法復原。**
請務必定期使用「設定 → 備份」匯出 JSON 到 iCloud Drive。
