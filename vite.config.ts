import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages 沒有伺服器端的 SPA fallback，直接開 /BloomIn/billing 會回 404。
 * Service Worker 裝好之後由 navigateFallback 接手，但「第一次」造訪深層網址
 * （書籤、分享連結、清過快取）會落空。GitHub Pages 會把 404 導向 404.html，
 * 因此放一份 index.html 的複本即可讓路由自己接手。
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const out = resolve('dist')
      copyFileSync(resolve(out, 'index.html'), resolve(out, '404.html'))
    },
  }
}

export default defineConfig({
  // GitHub Pages 專案頁：站台位於 <user>.github.io/BloomIn/。
  // 這個值會流進 import.meta.env.BASE_URL，路由與資源路徑都由它推導，
  // 因此改網址只需要改這一行。
  base: '/BloomIn/',
  plugins: [
    react(),
    spaFallback(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'BloomIn 美術班簽到',
        short_name: 'BloomIn',
        description: '美術班每日課程、學生簽到、時數計費與月結報表。資料僅存於本機。',
        lang: 'zh-Hant',
        dir: 'ltr',
        start_url: '/BloomIn/',
        scope: '/BloomIn/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#4B4A9B',
        background_color: '#FAF9F7',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 單機 App：所有資源都預先快取，執行期不需任何網路請求。
        // 必須含 base，否則子路由在離線時會找不到殼層
        navigateFallback: '/BloomIn/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
