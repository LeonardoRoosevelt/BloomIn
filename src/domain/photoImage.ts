/**
 * 照片存檔前的縮圖規則。
 *
 * 解碼與 JPEG 編碼是瀏覽器能力（createImageBitmap / canvas），iOS 上限制很多，
 * 因此抽成 codec 介面：這裡只決定「要輸出多大、什麼品質」，實際像素處理交給 codec。
 */

export interface DecodedImage {
  /** 已套用 EXIF 方向後的寬高 —— 直式照片存下來必須與相簿看到的一致 */
  width: number
  height: number
  /** 交還給 encode 的可繪製來源 */
  source: ImageBitmapSource
}

export interface ImageCodec {
  /** 無法解碼（非圖片、格式不支援）時拋錯。 */
  decode(file: Blob): Promise<DecodedImage>
  /** 輸出指定尺寸的 image/jpeg。 */
  encode(image: DecodedImage, width: number, height: number, quality: number): Promise<Blob>
}

export interface PreparedPhoto {
  blob: Blob
  thumb: Blob
  width: number
  height: number
}

/** 原圖：長邊 2000px 足以看清手寫字跡，又不會讓 IndexedDB 很快塞滿。 */
const FULL = { longEdge: 2000, quality: 0.85 }
/** 縮圖：列表只載它，避免一次解碼上百張原圖。 */
const THUMB = { longEdge: 400, quality: 0.7 }

export async function preparePhoto(file: Blob, codec: ImageCodec): Promise<PreparedPhoto> {
  const image = await codec.decode(file)
  const full = fit(image, FULL.longEdge)
  const thumb = fit(image, THUMB.longEdge)
  return {
    blob: await codec.encode(image, full.width, full.height, FULL.quality),
    thumb: await codec.encode(image, thumb.width, thumb.height, THUMB.quality),
    width: full.width,
    height: full.height,
  }
}

function fit(size: { width: number; height: number }, longEdge: number): { width: number; height: number } {
  // 只縮不放：放大不會多出細節，只會讓檔案變大
  const scale = Math.min(1, longEdge / Math.max(size.width, size.height))
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) }
}
