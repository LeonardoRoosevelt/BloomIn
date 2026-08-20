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

本專案部署到 **GitHub Pages 專案頁**：`https://<user>.github.io/BloomIn/`。
推送到 `main` 後由 `.github/workflows/deploy.yml` 自動建置並發布（測試沒過就不會部署）。

首次設定：在 repo 的 Settings → Pages → Source 選 **GitHub Actions**。

### 改網址要動的地方

`vite.config.ts` 的 `base` 是唯一的來源，路由與資源路徑都由 `import.meta.env.BASE_URL` 推導。
但 manifest 的 `start_url` / `scope` 與 workbox 的 `navigateFallback` 目前寫死同一個值，改 `base` 時要一起改。

> ⚠️ **換網址等於換掉瀏覽器儲存區，資料不會跟著搬。**
> 真的要換：先在舊網址匯出備份 → 開新網址 → 匯入還原。

## 安裝到 iPhone / iPad

1. 用 **Safari**（Chrome 不行）開啟部署後的網址
2. 分享 → **加入主畫面**
3. 從主畫面圖示啟動

## ⚠️ 資料保存

資料存在該網站的瀏覽器儲存區。**刪除主畫面圖示、或清除網站資料，學生與收費紀錄會一併消失且無法復原。**
請務必定期使用「設定 → 備份」匯出 JSON 到 iCloud Drive。
