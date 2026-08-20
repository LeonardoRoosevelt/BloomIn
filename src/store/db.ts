import { openDB, type IDBPDatabase } from 'idb'

/**
 * 全部領域資料以「單一 JSON 物件」存放於一筆 IndexedDB 記錄。
 *
 * 資料量極小（單一老師、數年累積不到 2MB），因此不需要索引或 range query；
 * 備份／還原就是把同一份物件序列化／反序列化。IndexedDB 的 put() 是原子交易，
 * 不會出現寫到一半損毀的狀態。
 */
const DB_NAME = 'bloomin'
const DB_VERSION = 1
const STORE = 'kv'
const STATE_KEY = 'state'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
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
