import { defineConfig } from 'vitest/config'

// 刻意不沿用 vite.config.ts：測試只跑純函式，不需要 React 與 PWA plugin。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
