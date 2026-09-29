import { IconBase, type IconProps } from './IconBase'

/*
 * 全套自製 icon。規格由 IconBase 統一施加：24×24 grid、--stroke-w、圓端點、
 * 只描邊、顏色繼承 currentColor。此檔案是唯一的 icon 來源，不引入任何第三方 icon 套件。
 */

/* ── 主導覽 ─────────────────────────────────── */

/** 今日：簽到板。刻意與課表的日曆區分，避免 tab bar 兩個圖示長得一樣。 */
export function IconToday(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M9 4.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="2.5" width="6" height="4" rx="1.2" />
      <path d="M9 13.5l2.4 2.4 4.1-4.6" />
    </IconBase>
  )
}

export function IconCalendar(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4M16 3v4" />
      <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" />
    </IconBase>
  )
}

export function IconStudents(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="9.5" cy="8" r="3.25" />
      <path d="M3.5 20a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3.25 3.25 0 0 1 0 5.6" />
      <path d="M17.3 14.6a6 6 0 0 1 3.2 5.4" />
    </IconBase>
  )
}

/** 帳務：鈔票。統計圖表與報表輸出都掛在這個分頁下。 */
export function IconBilling(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M6 10v4M18 10v4" />
    </IconBase>
  )
}

export function IconSettings(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4 7h9M17 7h3" />
      <path d="M4 12h3M11 12h9" />
      <path d="M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </IconBase>
  )
}

/* ── 動作 ───────────────────────────────────── */

export function IconPlus(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  )
}

export function IconEdit(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M16.4 3.9a2.1 2.1 0 0 1 3 3L8 18.3l-4 1 1-4z" />
      <path d="M14.4 5.9l3 3" />
    </IconBase>
  )
}

export function IconTrash(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M6.6 6.5l.8 12.1a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.8-12.1" />
      <path d="M10.4 10.5v6M13.6 10.5v6" />
    </IconBase>
  )
}

export function IconSearch(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4L20 20" />
    </IconBase>
  )
}

export function IconChevronLeft(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M15 5l-7 7 7 7" />
    </IconBase>
  )
}

export function IconChevronRight(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M9 5l7 7-7 7" />
    </IconBase>
  )
}

export function IconChevronDown(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M5 9l7 7 7-7" />
    </IconBase>
  )
}

export function IconClose(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
  )
}

export function IconCheck(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M4 12.5L9 17.5 20 6.5" />
    </IconBase>
  )
}

export function IconMore(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M6 12h.01M12 12h.01M18 12h.01" />
    </IconBase>
  )
}

/* ── 領域 ───────────────────────────────────── */

export function IconClock(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.3l3.2 1.9" />
    </IconBase>
  )
}

export function IconPhone(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="6.75" y="2.5" width="10.5" height="19" rx="2" />
      <path d="M10.75 18.5h2.5" />
    </IconBase>
  )
}

/** 課程類型：調色盤。 */
export function IconPalette(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.8-1.7 1.7-1.7h2a4.1 4.1 0 0 0 4.1-4.1c0-3.9-3.8-7.3-8.5-7.3z" />
      {/* 顏料點用實心圓，小尺寸下比描邊清楚 */}
      <circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

/** 課程內容 / 備註。 */
export function IconNote(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z" />
      <path d="M13.5 3.5v5h5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </IconBase>
  )
}

/** 照片紀錄本：相框裡的山與太陽。 */
export function IconPhoto(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="9.5" r="1.75" />
      <path d="M20.5 15.5l-4.8-4.8a1.5 1.5 0 0 0-2.1 0L5 19.3" />
    </IconBase>
  )
}

export function IconUser(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </IconBase>
  )
}

/* ── 出席狀態 ───────────────────────────────── */

/** 出席 */
export function IconStatusPresent(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.4 12.2l2.5 2.5 4.7-5.2" />
    </IconBase>
  )
}

/** 遲到 */
export function IconStatusLate(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 1.8" />
    </IconBase>
  )
}

/** 無故缺席 */
export function IconStatusAbsent(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.3 9.3l5.4 5.4M14.7 9.3l-5.4 5.4" />
    </IconBase>
  )
}

/** 事先請假 */
export function IconStatusExcused(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12h7" />
    </IconBase>
  )
}

/* ── 輸出入 ─────────────────────────────────── */

export function IconPrinter(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M7 9V3.5h10V9" />
      <path d="M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14.5" width="10" height="6" rx="1.2" />
    </IconBase>
  )
}

export function IconShare(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 15.5V3.5" />
      <path d="M8 7.5l4-4 4 4" />
      <path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </IconBase>
  )
}

export function IconDownload(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 3.5v11.5" />
      <path d="M7.5 10.5l4.5 4.5 4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </IconBase>
  )
}

export function IconUpload(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 20.5V9" />
      <path d="M7.5 13.5L12 9l4.5 4.5" />
      <path d="M4.5 4.5h15" />
    </IconBase>
  )
}

/** 備份：盾牌加勾，強調「保住資料」而非單純存檔。 */
export function IconBackup(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 3l7.5 3v5.6c0 4.3-3 8.3-7.5 9.4-4.5-1.1-7.5-5.1-7.5-9.4V6z" />
      <path d="M9 12l2.2 2.2L15.4 10" />
    </IconBase>
  )
}

/* ── 回饋 ───────────────────────────────────── */

export function IconAlert(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M12 3.5L22 20.5H2z" />
      <path d="M12 10v4" />
      <path d="M12 17.3h.01" />
    </IconBase>
  )
}

export function IconInfo(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <path d="M12 7.75h.01" />
    </IconBase>
  )
}

export function IconRefresh(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 4v5h-5" />
    </IconBase>
  )
}
