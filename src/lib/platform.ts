/** 是否以「加入主畫面」的獨立視窗開啟（而非 Safari 分頁）。 */
export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari 專屬旗標，非標準且未收錄於 TS lib
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ 的 UA 偽裝成 macOS，靠觸控點數區分
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** 這台裝置能不能用原生分享面板送出檔案（iOS 上匯出報表的主要路徑）。 */
export function canShareFiles(): boolean {
  if (!navigator.canShare) return false
  const probe = new File(['probe'], 'probe.txt', { type: 'text/plain' })
  try {
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}
