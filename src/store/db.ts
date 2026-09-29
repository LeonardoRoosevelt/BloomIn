import { openDB, type IDBPDatabase } from 'idb'

/**
 * 全部領域資料以「單一 JSON 物件」存放於一筆 IndexedDB 記錄。
 *
 * 資料量極小（單一老師、數年累積不到 2MB），因此不需要索引或 range query；
 * 備份／還原就是把同一份物件序列化／反序列化。IndexedDB 的 put() 是原子交易，
 * 不會出現寫到一半損毀的狀態。
 */
const DB_NAME = 'bloomin'
const DB_VERSION = 2
const STORE = 'kv'
const STATE_KEY = 'state'
/**
 * 照片另存一個 store 而不進 state：照片是 Blob、體積大，
 * 放進 state 會讓每次存檔都重寫整包，也會讓 JSON 備份暴增。
 */
export const PHOTOS_STORE = 'photos'

let dbPromise: Promise<IDBPDatabase> | null = null

/*
 * 升級被擋住：另一個分頁／視窗還開著舊版連線（舊版沒有處理 versionchange，不會自己關）。
 * openDB 會一直等到那條連線關閉，這段期間畫面必須說明原因，否則看起來就是白畫面。
 * 等待本身是對的 —— 舊連線一關就會自動完成，所以只「通知」，不把它當成錯誤。
 */
const blockedListeners = new Set<() => void>()

export function onUpgradeBlocked(listener: () => void): () => void {
  blockedListeners.add(listener)
  return () => blockedListeners.delete(listener)
}

export function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    // 依 oldVersion 增量升級：舊版使用者升級時只補缺的部分，kv 裡的資料原封不動
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore(STORE)
      if (oldVersion < 2) {
        const photos = db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' })
        photos.createIndex('studentId', 'studentId')
      }
    },
    blocked() {
      for (const listener of blockedListeners) listener()
    },
    // 反過來，日後有更新版本要升級時，本分頁要主動讓出連線，不重演上面的卡住。
    // 必須在 versionchange 事件當下同步關閉，否則對方仍會收到 blocked。
    // 關閉後本分頁已是舊版，之後的讀寫會失敗，重新開啟 App 即可。
    blocking(_currentVersion, _blockedVersion, event) {
      ;(event.target as IDBDatabase).close()
      dbPromise = null
    },
  })
  return dbPromise
}

export async function loadState<T>(): Promise<T | undefined> {
  const db = await getDb()
  return db.get(STORE, STATE_KEY) as Promise<T | undefined>
}

export async function saveState<T>(state: T): Promise<void> {
  const db = await getDb()
  await db.put(STORE, state, STATE_KEY)
}

/** 僅供還原流程與可行性自檢使用。 */
export async function clearState(): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, STATE_KEY)
}

/**
 * 向瀏覽器申請「持久化儲存」，降低被系統回收的機率。
 * iOS 不保證核准，回傳值僅供顯示，不可作為資料安全的依據 —— 真正的保障是定期備份。
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}

/* ── 照片備份時間 ─────────────────────────────
 * 刻意不進 AppState：放進去就得改 SCHEMA_VERSION 與既有 JSON 備份格式，
 * 而照片備份本來就是獨立的檔案。只有真的送出備份才更新。
 */
const PHOTO_BACKUP_AT_KEY = 'photoBackupAt'

export async function loadPhotoBackupAt(): Promise<string | null> {
  const db = await getDb()
  return ((await db.get(STORE, PHOTO_BACKUP_AT_KEY)) as string | undefined) ?? null
}

export async function savePhotoBackupAt(at: string): Promise<void> {
  const db = await getDb()
  await db.put(STORE, at, PHOTO_BACKUP_AT_KEY)
}

/* ── 可行性自檢專用記錄 ──────────────────────────────
 * 與領域資料分開存放，避免污染備份檔的 schema。
 */
const PROBE_KEY = 'selfcheck'

export interface Probe {
  firstSeenAt: string
  lastSeenAt: string
  launchCount: number
}

export async function loadProbe(): Promise<Probe | undefined> {
  const db = await getDb()
  return db.get(STORE, PROBE_KEY) as Promise<Probe | undefined>
}

export async function saveProbe(probe: Probe): Promise<void> {
  const db = await getDb()
  await db.put(STORE, probe, PROBE_KEY)
}

/* ── 匯入前的回復點 ─────────────────────────────
 * 匯入是完整覆蓋，所以覆蓋前先把現況存到另一個 key。
 * 選錯檔案時還救得回來 —— 這比匯入本身更重要。
 */
const ROLLBACK_KEY = 'rollback'

export interface Rollback<T> {
  savedAt: string
  state: T
}

export async function saveRollback<T>(state: T): Promise<void> {
  const db = await getDb()
  await db.put(STORE, { savedAt: new Date().toISOString(), state } satisfies Rollback<T>, ROLLBACK_KEY)
}

export async function loadRollback<T>(): Promise<Rollback<T> | undefined> {
  const db = await getDb()
  return db.get(STORE, ROLLBACK_KEY) as Promise<Rollback<T> | undefined>
}

export async function clearRollback(): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, ROLLBACK_KEY)
}
