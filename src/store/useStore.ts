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
import { loadState, saveState } from './db'

interface StoreState {
  data: AppState
  hydrated: boolean

  hydrate: () => Promise<void>
  /** 直接以整份 state 取代現況，供備份還原使用。 */
  replaceAll: (next: AppState) => void

  updateSettings: (patch: Partial<Settings>) => void

  addCourseType: (input: Omit<CourseType, 'id'>) => string
  updateCourseType: (id: string, patch: Partial<Omit<CourseType, 'id'>>) => void

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

  hydrate: async () => {
    const stored = await loadState<AppState>()
    set({ data: stored ?? createInitialState(), hydrated: true })
  },

  replaceAll: (next) => commit(set, () => next),

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

export async function flushPersist(): Promise<void> {
  clearTimeout(timer)
  if (!pending) return
  const state = pending
  pending = null
  await saveState(state)
}

// iOS 可能不觸發 pagehide 就終止 App，visibilitychange 是最可靠的存檔時機。
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPersist()
  })
  window.addEventListener('pagehide', () => void flushPersist())
}
