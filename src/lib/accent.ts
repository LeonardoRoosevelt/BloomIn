import type { AccentToken } from '../domain/types'

/**
 * 把課程類型的 accent token 轉成 CSS 變數參照。
 * 元件不得自行拼字串或寫死色碼，一律經過這裡，色票才只有 tokens.css 一個來源。
 */
export function accentVar(token: AccentToken): string {
  return `var(--accent-${token})`
}

/** 用於底色的淡化版本（12% 混入透明），確保與文字對比一致。 */
export function accentSoft(token: AccentToken): string {
  return `color-mix(in srgb, var(--accent-${token}) 12%, transparent)`
}
