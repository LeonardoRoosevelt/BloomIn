import { defineConfig } from 'vitest/config'

// 刻意不沿用 vite.config.ts：測試不需要 PWA plugin。
// 純函式與資料層（*.test.ts）跑 node；元件測試（*.test.tsx）才需要 DOM，跑 jsdom。
// 分成兩個 project，讓既有的 node 測試不必付出 jsdom 的啟動成本與全域差異。
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['src/test/setupDom.ts'],
        },
      },
    ],
  },
})
