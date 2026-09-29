import { create } from 'zustand'
import { computeBilling } from '../domain/billing'
import {
  createInitialState,
  type AppState,
  type Attendance,
  type CourseType,
  type Session,
  type Settings,
  type Student,
} from '../domain/types'
import { newId } from '../lib/id'
import { loadRollback, loadState, onSuperseded, onUpgradeBlocked, saveRollback, saveState } from './db'

interface StoreState {
  data: AppState
  hydrated: boolean
  /** 載入失敗的原因；非 null 時畫面必須顯示錯誤而非空白 */
  hydrateError: string | null
  /** 資料庫升級正被其他開著的舊版分頁擋住；舊連線關閉後會自動繼續載入 */
  upgradeBlocked: boolean
  /** 本分頁已把資料庫讓給較新版本，無法再讀寫；畫面必須擋住輸入並請使用者重新開啟 */
  superseded: boolean
  /** 最近一次存檔失敗的原因；非 null 時畫面必須常駐警告，下次成功寫入後清除 */
  persistError: string | null

  hydrate: () => Promise<void>
  /**
   * 以匯入的 state 完整取代現況。覆蓋前會先存下回復點，選錯檔案時還救得回來。
   */
  importState: (next: AppState) => Promise<void>
  /** 從回復點還原到最近一次匯入之前的狀態。找不到回復點時回傳 false。 */
  rollbackImport: () => Promise<boolean>
  /** 記下備份完成的時間，提醒橫幅依此判斷。 */
  markBackedUp: (at: string) => void

  updateSettings: (patch: Partial<Settings>) => void

  addCourseType: (input: Omit<CourseType, 'id'>) => string
  updateCourseType: (id: string, patch: Partial<Omit<CourseType, 'id'>>) => void
  /** 僅在沒有任何課程引用它時才會真的刪除；有引用時不做任何事。 */
  deleteCourseType: (id: string) => void

  addStudent: (input: Omit<Student, 'id' | 'createdAt'>) => string
  updateStudent: (id: string, patch: Partial<Omit<Student, 'id' | 'createdAt'>>) => void

  addSession: (input: Omit<Session, 'id'>) => string
  updateSession: (id: string, patch: Partial<Omit<Session, 'id'>>) => void
  deleteSession: (id: string) => void

  /** 新增或更新一筆出席紀錄，並即時重算該筆的時數與金額快照。 */
  setAttendance: (
    sessionId: string,
    studentId: string,
    patch: Partial<Pick<Attendance, 'status' | 'actualStart' | 'actualEnd' | 'manualAmountOverride' | 'note'>>,
  ) => void
}

export const useStore = create<StoreState>((set) => ({
  data: createInitialState(),
  hydrated: false,
  hydrateError: null,
  upgradeBlocked: false,
  superseded: false,
  persistError: null,

  /**
   * 載入失敗時不得靜默 —— 之前這裡的例外會讓 App 停在完全空白的畫面，
   * 使用者看不到任何線索。更重要的是：讀取失敗時絕不能讓人開始輸入，
   * 否則新資料會覆蓋掉可能還救得回來的舊資料。
   */
  hydrate: async () => {
    const stopListening = onUpgradeBlocked(() => set({ upgradeBlocked: true }))
    try {
      const stored = await loadState<AppState>()
      set({ data: stored ?? createInitialState(), hydrated: true, hydrateError: null, upgradeBlocked: false })
    } catch (err) {
      set({ hydrated: true, hydrateError: err instanceof Error ? err.message : String(err), upgradeBlocked: false })
    } finally {
      stopListening()
    }
  },

  importState: async (next) => {
    // 先把現況寫進回復點，再覆蓋 —— 順序反過來就沒有救援機會了
    await saveRollback(useStore.getState().data)
    commit(set, () => next)
    await flushPersist()
  },

  rollbackImport: async () => {
    const snapshot = await loadRollback<AppState>()
    if (!snapshot) return false
    commit(set, () => snapshot.state)
    await flushPersist()
    return true
  },

  markBackedUp: (at) =>
    commit(set, (d) => ({ ...d, settings: { ...d.settings, lastBackupAt: at } })),

  updateSettings: (patch) =>
    commit(set, (d) => ({ ...d, settings: { ...d.settings, ...patch } })),

  addCourseType: (input) => {
    const id = newId()
    commit(set, (d) => ({ ...d, courseTypes: [...d.courseTypes, { ...input, id }] }))
    return id
  },

  // 刻意不重算既有出席紀錄：調漲學費不該回頭改動已結算的歷史帳。
  updateCourseType: (id, patch) =>
    commit(set, (d) => ({
      ...d,
      courseTypes: d.courseTypes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  /**
   * 只刪除沒有被任何課程引用的類型。
   *
   * 已被引用的類型若被移除，過去的課程會失去名稱與識別色，月結單上只剩一個
   * 認不出來的項目。這種情況請改用封存（archived），畫面上會擋下刪除並說明原因。
   */
  deleteCourseType: (id) =>
    commit(set, (d) =>
      d.sessions.some((s) => s.courseTypeId === id)
        ? d
        : { ...d, courseTypes: d.courseTypes.filter((c) => c.id !== id) },
    ),

  addStudent: (input) => {
    const id = newId()
    const student: Student = { ...input, id, createdAt: new Date().toISOString() }
    commit(set, (d) => ({ ...d, students: [...d.students, student] }))
    return id
  },

  updateStudent: (id, patch) =>
    commit(set, (d) => ({
      ...d,
      students: d.students.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),

  addSession: (input) => {
    const id = newId()
    commit(set, (d) => ({ ...d, sessions: [...d.sessions, { ...input, id }] }))
    return id
  },

  /**
   * 修改課堂時間或課程類型後，重算「這一堂」的所有出席金額。
   *
   * 這與費率快照原則並不衝突：快照要擋的是日後調漲費率回頭竄改舊帳，
   * 而修正這堂課打錯的時間是訂正，本來就該讓金額跟著更新。
   */
  updateSession: (id, patch) =>
    commit(set, (d) => {
      const sessions = d.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s))
      const session = sessions.find((s) => s.id === id)
      if (!session) return { ...d, sessions }
      const next = { ...d, sessions }
      return {
        ...next,
        attendances: d.attendances.map((a) =>
          a.sessionId === id ? recompute(a, next) : a,
        ),
      }
    }),

  deleteSession: (id) =>
    commit(set, (d) => ({
      ...d,
      sessions: d.sessions.filter((s) => s.id !== id),
      attendances: d.attendances.filter((a) => a.sessionId !== id),
    })),

  setAttendance: (sessionId, studentId, patch) =>
    commit(set, (d) => {
      const existing = d.attendances.find(
        (a) => a.sessionId === sessionId && a.studentId === studentId,
      )
      const base: Attendance = existing ?? {
        id: newId(),
        sessionId,
        studentId,
        status: 'present',
        actualStart: null,
        actualEnd: null,
        billedMinutes: 0,
        appliedRate: 0,
        amount: 0,
        manualAmountOverride: null,
        note: '',
      }
      const updated = recompute({ ...base, ...patch }, d)
      return {
        ...d,
        attendances: existing
          ? d.attendances.map((a) => (a.id === existing.id ? updated : a))
          : [...d.attendances, updated],
      }
    }),
}))

/** 依當下的課堂、學生與費率設定，重算一筆出席紀錄的快照欄位。 */
function recompute(a: Attendance, d: AppState): Attendance {
  const session = d.sessions.find((s) => s.id === a.sessionId)
  if (!session) return a
  const student = d.students.find((s) => s.id === a.studentId)
  if (!student) return a
  const courseType = d.courseTypes.find((c) => c.id === session.courseTypeId) ?? null

  const result = computeBilling({
    attendance: a,
    session,
    student,
    courseType,
    settings: d.settings,
  })
  return { ...a, ...result }
}

/* ── 持久化 ───────────────────────────────────────
 * 每次變更都把整份 state 寫回 IndexedDB。debounce 避免連續操作時反覆寫入，
 * 但 App 隨時可能被 iOS 直接終止，因此在切到背景時必須立刻沖刷。
 */
let timer: ReturnType<typeof setTimeout> | undefined
let pending: AppState | null = null

function commit(
  set: (partial: { data: AppState }) => void,
  update: (current: AppState) => AppState,
): void {
  const next = update(useStore.getState().data)
  set({ data: next })
  schedulePersist(next)
}

function schedulePersist(state: AppState): void {
  pending = state
  clearTimeout(timer)
  timer = setTimeout(() => void flushPersist(), 300)
}

/**
 * 進行中的存檔寫入。同一時間只允許一個：若失敗的舊寫入與新的寫入並行，
 * 舊快照可能在新的已存好之後才被重試寫入，把裝置上的資料倒退回去。
 */
let inFlight: Promise<void> | null = null

export async function flushPersist(): Promise<void> {
  clearTimeout(timer)
  // 等前一個寫入結束（成功或失敗）再決定要寫什麼 —— 那時的 pending 才是真正最新的
  while (inFlight) await inFlight
  // 已讓出連線：寫入必然失敗，只會變成未處理的錯誤；讓出前的最後變更已由 db.ts 盡力寫入（成功與否無從得知，所以提示畫面不做保證）
  if (useStore.getState().superseded) {
    pending = null
    return
  }
  if (!pending) return
  const state = pending
  pending = null
  inFlight = (async () => {
    try {
      await saveState(state)
      if (useStore.getState().persistError !== null) useStore.setState({ persistError: null })
    } catch (err) {
      // 沒存進去的變更不能丟：放回 pending 等下次存檔重試。
      // 寫入期間若又有新變更，保留新的 —— 每次存的都是完整快照，新的已包含這次的內容
      pending ??= state
      // 不往外拋：呼叫端多是計時器或頁面事件，拋出只會變成沒人處理的錯誤；改由畫面常駐警告
      useStore.setState({ persistError: err instanceof Error ? err.message : String(err) })
    }
  })()
  try {
    await inFlight
  } finally {
    inFlight = null
  }
}

// 被較新版本取代時：先交出還沒存的 state 讓 db.ts 寫入，再標記 superseded 讓畫面擋住輸入
onSuperseded({
  unsavedState: () => pending,
  superseded: () => {
    clearTimeout(timer)
    pending = null
    useStore.setState({ superseded: true })
  },
})

// iOS 可能不觸發 pagehide 就終止 App，visibilitychange 是最可靠的存檔時機。
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPersist()
  })
  window.addEventListener('pagehide', () => void flushPersist())
}
