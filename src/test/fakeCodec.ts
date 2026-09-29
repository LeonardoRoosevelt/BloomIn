import type { ImageCodec } from '../domain/photoImage'

/*
 * 假的圖片 codec：取代瀏覽器的解碼與 canvas 編碼這道外部邊界。
 *
 * 「圖檔」內容是一段 JSON，描述原始像素尺寸與是否帶 EXIF 旋轉 90 度；
 * decode 依真實瀏覽器（imageOrientation: 'from-image'）的契約回傳「已套用方向」的寬高。
 * encode 產出的 JPEG Blob 內容記下輸出尺寸與品質，測試可讀回來驗證。
 */

export function fakeImageFile(
  width: number,
  height: number,
  options: { exifRotate90: boolean } = { exifRotate90: false },
): File {
  return new File([JSON.stringify({ width, height, exifRotate90: options.exifRotate90 })], 'photo.jpg', {
    type: 'image/jpeg',
  })
}

/** 一個瀏覽器無法解碼的檔案（例如選到 PDF）。 */
export function unreadableFile(): File {
  return new File(['%PDF-1.7 not an image'], 'scan.pdf', { type: 'application/pdf' })
}

export const fakeCodec: ImageCodec = {
  async decode(file) {
    let spec: { width: number; height: number; exifRotate90: boolean }
    try {
      spec = JSON.parse(await file.text()) as typeof spec
    } catch {
      throw new Error('無法解碼')
    }
    return spec.exifRotate90
      ? { width: spec.height, height: spec.width, source: file }
      : { width: spec.width, height: spec.height, source: file }
  },
  async encode(_image, width, height, quality) {
    return new Blob([JSON.stringify({ width, height, quality })], { type: 'image/jpeg' })
  },
}

/** 讀回假 codec 編出來的 JPEG 尺寸與品質。 */
export async function encodedOf(blob: Blob): Promise<{ width: number; height: number; quality: number }> {
  return JSON.parse(await blob.text()) as { width: number; height: number; quality: number }
}
