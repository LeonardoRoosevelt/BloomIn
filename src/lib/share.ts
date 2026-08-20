import { canShareFiles } from './platform'

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/**
 * 把檔案交給使用者保存。
 *
 * iOS 的 <a download> 在 standalone PWA 下行為不穩，因此優先使用原生分享面板
 * （可存到「檔案」/ iCloud Drive、或直接送 AirDrop / LINE / Email），
 * 不支援時才退回下載連結。
 */
export async function shareFile(file: File, title: string): Promise<ShareOutcome> {
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      // 使用者在分享面板按取消會拋 AbortError，這不是錯誤，也不該退回下載
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // 其他錯誤（權限、未支援）才退回下載
    }
  }
  downloadFile(file)
  return 'downloaded'
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 立即 revoke 會讓部分瀏覽器來不及讀取，延後釋放
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
