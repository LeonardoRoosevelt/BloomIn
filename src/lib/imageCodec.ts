import type { ImageCodec } from '../domain/photoImage'

/**
 * 真正的瀏覽器圖片 codec（無單元測試，需在 iPhone 實機驗證）。
 *
 * iOS 的限制決定了這裡的做法：
 * - 記憶體：一張 48MP 的照片完整解碼要近 200MB，Safari 可能直接讓分頁崩潰。
 *   因此 decode 只讀尺寸，不持有點陣；encode 請瀏覽器直接解碼成目標尺寸。
 * - canvas 像素上限：只開輸出尺寸（≤2000px）的 canvas，不會碰到上限。
 * - 方向：imageOrientation 'from-image' 讓 EXIF 旋轉烘焙進像素，直式照片不會橫倒。
 */
export const browserCodec: ImageCodec = {
  async decode(file) {
    // <img> 載入後的 naturalWidth/Height 已套用 EXIF 方向，且只要尺寸時瀏覽器不必保留整張點陣
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('無法解碼這個檔案'))
        img.src = url
      })
      if (img.naturalWidth === 0 || img.naturalHeight === 0) throw new Error('無法解碼這個檔案')
      return { width: img.naturalWidth, height: img.naturalHeight, source: file }
    } finally {
      URL.revokeObjectURL(url)
    }
  },

  async encode(image, width, height, quality) {
    const bitmap = await orientedBitmap(image.source, width, height)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('無法建立畫布')
      // JPEG 沒有透明度：不先鋪底，透明 PNG 的透明處會變成黑色。
      // 白色是紙本的底色，這是像素資料不是 UI 樣式，所以不走 design tokens
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      // iOS 的 canvas 記憶體要等 GC 才回收，先縮成 0 立即釋放，連續處理多張時才不會累積
      canvas.width = 0
      canvas.height = 0
      if (!blob) throw new Error('JPEG 編碼失敗')
      return blob
    } finally {
      bitmap.close()
    }
  },
}

/**
 * 直接解碼成目標尺寸，避開完整解碼的記憶體開銷。
 *
 * 不是每個瀏覽器都支援 resizeWidth/resizeHeight（不支援時可能直接拋錯），
 * 也有實作先縮放再套方向（直式照片會被壓扁）。所以逐級退回：
 * 帶縮放選項 → 只帶方向選項 → 不帶任何選項，後兩者交給 drawImage 縮放。
 */
async function orientedBitmap(source: ImageBitmapSource, width: number, height: number): Promise<ImageBitmap> {
  try {
    const resized = await createImageBitmap(source, {
      imageOrientation: 'from-image',
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    })
    if (resized.width === width && resized.height === height) return resized
    resized.close()
  } catch {
    // 不支援縮放選項：往下退回
  }
  try {
    return await createImageBitmap(source, { imageOrientation: 'from-image' })
  } catch {
    // 連方向選項都不支援的舊實作；現行規格預設即會套用 EXIF 方向
    return createImageBitmap(source)
  }
}
