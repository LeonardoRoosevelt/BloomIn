/**
 * 空狀態插圖：畫架。
 *
 * 與 icon 共用同一套線條語言 —— viewBox 單位對齊實際像素，因此 --stroke-w
 * 在 96px 呈現時仍是 1.5px，與 24px 的 icon 視覺粗細完全一致。
 */
export function Easel({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ strokeWidth: 'var(--stroke-w)' }}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="20" y="10" width="56" height="44" rx="3" />
      <path d="M14 58h68" />
      <path d="M30 58 20 88M66 58l10 30M48 58v26" />
      {/* 畫布上的兩筆抽象筆觸 */}
      <path d="M29 42c6-13 12-13 18-4s12 6 20-9" />
      <circle cx="61" cy="22" r="4" />
    </svg>
  )
}
