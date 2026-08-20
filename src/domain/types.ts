import { newId } from '../lib/id'

/**
 * BloomIn 領域模型。
 *
 * 刻意不使用選填欄位（`?`），空值一律以空字串或 null 表示。
 * 理由：整份 state 會被序列化成備份 JSON，欄位存在與否若不固定，
 * 還原時的相容性判斷會變得脆弱。
 */

/** 備份檔的 schema 版本；日後改變欄位結構時遞增，還原流程據此判斷是否需要轉換。 */
export const SCHEMA_VERSION = 1

/** 計費時數的進位規則。 */
export type Rounding = 'exact' | 'nearest15' | 'nearest30'

/**
 * 出席狀態。
 * - present  出席
 * - late     遲到（照實際時間計費，與 present 的差別只在統計上要看得出來）
 * - absent   無故缺席（是否照收由 CourseType.chargeOnAbsence 決定）
 * - excused  事先請假（一律不計費）
 */
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

/** 課程類型的識別色，取自 tokens.css 的固定六色 accent 池。 */
export type AccentToken =
  | 'terracotta'
  | 'azure'
  | 'moss'
  | 'wisteria'
  | 'ochre'
  | 'celadon'

/**
 * 指派順序即驗證順序：圖表配色驗證器檢查的是「相鄰對」的可分辨度，
 * 而芥黃與苔綠色相相鄰，因此刻意用紫藤把兩者隔開。改動順序前請重跑
 * tokens.css 註解裡記載的驗證。
 */
export const ACCENT_TOKENS: readonly AccentToken[] = [
  'terracotta',
  'azure',
  'moss',
  'wisteria',
  'ochre',
  'celadon',
]

export interface Settings {
  /** 月結單抬頭 */
  studioName: string
  teacherName: string
  /** 費率解析的最後保底值 */
  defaultHourlyRate: number
  rounding: Rounding
  /** 超過幾天未備份就顯示常駐提醒橫幅 */
  backupReminderDays: number
  /** 最後一次成功匯出備份的時間（ISO 字串） */
  lastBackupAt: string | null
}

export interface CourseType {
  id: string
  name: string
  hourlyRate: number
  /** 無故缺席（absent）是否仍照排定時數收費。事先請假（excused）永遠不收。 */
  chargeOnAbsence: boolean
  accent: AccentToken
  archived: boolean
}

export interface Student {
  id: string
  name: string
  phone: string
  /** 兒童班用；成人班留空 */
  guardianName: string
  guardianPhone: string
  /** 個別費率覆寫，null 表示沿用課程類型費率。0 是合法值（免費生）。 */
  hourlyRateOverride: number | null
  courseTypeIds: string[]
  note: string
  archived: boolean
  createdAt: string
}

/** 一堂課。每日手動建立，不做週期性排程。 */
export interface Session {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  startTime: string
  /** HH:mm */
  endTime: string
  courseTypeId: string
  /** 當日課程內容安排 */
  topic: string
  note: string
  rosterStudentIds: string[]
}

export interface Attendance {
  id: string
  sessionId: string
  studentId: string
  status: AttendanceStatus
  /** 實際起訖時間，null 表示沿用該堂課的排定時間 */
  actualStart: string | null
  actualEnd: string | null

  /* ── 以下四欄是「結算當下的快照」，不是即時衍生值 ──
   * 半年後調漲學費時，去年的月結單金額必須維持原樣，否則帳對不起來。
   * 這是計費正確性的底線，任何顯示邏輯都不得改為即時重算。 */
  billedMinutes: number
  appliedRate: number
  amount: number
  /** 直接指定金額，優先於一切費率計算。null 表示不覆寫。 */
  manualAmountOverride: number | null

  note: string
}

export interface AppState {
  schemaVersion: number
  settings: Settings
  courseTypes: CourseType[]
  students: Student[]
  sessions: Session[]
  attendances: Attendance[]
}

/**
 * 首次啟動時預先建立幾個常見課程類型。
 *
 * 沒有課程類型就無法建課，讓使用者一進來面對空白清單等於卡住；
 * 這幾筆是可以直接改名、改價或刪除的起點，不是硬編死的規則。
 */
function seedCourseTypes(defaultRate: number): CourseType[] {
  return [
    { name: '素描', accent: 'terracotta' as const },
    { name: '水彩', accent: 'azure' as const },
    { name: '兒童繪畫班', accent: 'moss' as const },
  ].map((c) => ({
    id: newId(),
    name: c.name,
    hourlyRate: defaultRate,
    chargeOnAbsence: false,
    accent: c.accent,
    archived: false,
  }))
}

export function createInitialState(): AppState {
  const defaultHourlyRate = 500
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      studioName: '',
      teacherName: '',
      defaultHourlyRate,
      rounding: 'nearest15',
      backupReminderDays: 7,
      lastBackupAt: null,
    },
    courseTypes: seedCourseTypes(defaultHourlyRate),
    students: [],
    sessions: [],
    attendances: [],
  }
}
