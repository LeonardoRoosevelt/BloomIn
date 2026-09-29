import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Sheet } from '../components/ui/Sheet'
import {
  IconChevronLeft,
  IconClose,
  IconNote,
  IconPlus,
  IconStudents,
  IconTrash,
} from '../components/icons'
import { formatDate, formatDateLong, formatMonth, todayISO } from '../lib/date'
import { browserCodec } from '../lib/imageCodec'
import { storageEstimate } from '../store/db'
import { goBack, navigate } from '../lib/router'
import {
  addPhotoFiles,
  deletePhoto,
  describeAddResult,
  getPhoto,
  listPhotosByMonth,
  type Photo,
  type PhotoSummary,
} from '../store/photos'
import { useStore } from '../store/useStore'
import s from './StudentPhotos.module.css'

type Groups = { month: string; photos: PhotoSummary[] }[]

/**
 * 學生照片紀錄本：保存紙本紀錄（簽到簿、作品紀錄卡）的翻拍照。
 */
export function StudentPhotos({ studentId }: { studentId: string }) {
  const student = useStore((st) => st.data.students.find((x) => x.id === studentId))
  const fileRef = useRef<HTMLInputElement>(null)
  // null = 尚未載入；避免先閃出空狀態再跳成有照片
  const [groups, setGroups] = useState<Groups | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [picked, setPicked] = useState<File[] | null>(null)
  const [recordDate, setRecordDate] = useState('')
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)

  const reload = useCallback(async () => {
    setGroups(await listPhotosByMonth(studentId))
  }, [studentId])

  useEffect(() => {
    void reload()
  }, [reload])

  // 照片是最吃空間的資料，讓老師看得到快滿了；每次列表變動後重新估算
  // 取不到（不支援、私密瀏覽）就不顯示；這只是參考資訊，不值得打斷老師
  useEffect(() => {
    storageEstimate()
      .then(setUsage)
      .catch(() => setUsage(null))
  }, [groups])

  function onPicked(files: File[]) {
    if (files.length === 0) return
    setPicked(files)
    // 紀錄日期預設今天；翻拍舊紙本時老師再改成紙本上的日期
    setRecordDate(todayISO())
    setCaption('')
    setMessage(null)
  }

  async function save() {
    // 縮圖大圖在 iPhone 上要好幾秒，處理中再按一次不能再存一份
    if (picked === null || saving) return
    setSaving(true)
    try {
      const result = await addPhotoFiles(
        studentId,
        picked,
        // 多張時只共用日期，說明留空，之後逐張編輯
        { recordDate, caption: picked.length === 1 ? caption.trim() : '' },
        browserCodec,
      )
      setMessage({
        kind: result.unreadable > 0 || result.noSpace > 0 ? 'err' : 'ok',
        text: describeAddResult(result),
      })
      setPicked(null)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  // 沿用學生詳情頁的處理：壞連結不該是一片空白
  if (!student) {
    return (
      <EmptyState
        art={<IconStudents size={72} />}
        title="找不到這位學生"
        action={<Button onClick={() => navigate({ name: 'students' })}>回到學生列表</Button>}
      />
    )
  }

  const addButton = (
    <Button onClick={() => fileRef.current?.click()}>
      <IconPlus size={18} />
      新增照片
    </Button>
  )

  return (
    <>
      <div className={s.backRow}>
        <Button variant="ghost" iconOnly aria-label="返回" onClick={goBack}>
          <IconChevronLeft size={22} />
        </Button>
        <span className={s.backLabel}>{student.name}</span>
      </div>

      <div className={s.titleRow}>
        <h1 className={s.title}>照片紀錄本</h1>
        {groups !== null && groups.length > 0 && addButton}
      </div>

      {/* accept="image/*" 讓 iOS 同時提供「拍照」與「照片圖庫」 */}
      <input
        ref={fileRef}
        className={s.file}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // 清掉 value，選同一批檔案兩次才會再次觸發 change
          e.target.value = ''
          onPicked(files)
        }}
      />

      {usage !== null && (
        <p className={s.usage}>
          已使用 {formatMB(usage.usage)}，可用配額 {formatMB(usage.quota)}
        </p>
      )}

      {message && (
        <p className={`${s.message} ${message.kind === 'ok' ? s.ok : s.err}`}>{message.text}</p>
      )}

      {groups !== null && groups.length === 0 && (
        <EmptyState
          art={<IconNote size={64} />}
          title="還沒有照片"
          description="把紙本簽到簿、作品紀錄卡拍下來，依日期整理在這裡。"
          action={addButton}
        />
      )}

      {groups?.map(({ month, photos }) => (
        <section key={month}>
          <h2 className={s.monthHead}>{formatMonth(month)}</h2>
          <div className={s.grid}>
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                className={s.cell}
                aria-label={`開啟 ${formatDate(p.recordDate)} 的照片`}
                onClick={() => setViewingId(p.id)}
              >
                <Thumb blob={p.thumb} />
                <span className={s.cellDate}>{formatDate(p.recordDate)}</span>
                {p.caption !== '' && <span className={s.cellCaption}>{p.caption}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}

      {viewingId !== null && (
        <Viewer
          photoId={viewingId}
          onClose={() => setViewingId(null)}
          onDeleted={() => {
            setViewingId(null)
            void reload()
          }}
        />
      )}

      <Sheet
        open={picked !== null}
        onClose={() => {
          if (!saving) setPicked(null)
        }}
        title="新增照片"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setPicked(null)}>
              取消
            </Button>
            <Button disabled={saving || recordDate === ''} onClick={() => void save()}>
              {saving ? '處理中…' : '儲存'}
            </Button>
          </>
        }
      >
        {picked !== null && (
          <>
            <p className={s.pickedCount}>已選 {picked.length} 張</p>
            <Field label="紀錄日期" hint="紙本紀錄上的日期，不是拍照的日期。">
              <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
            </Field>
            {picked.length === 1 && (
              <Field label="說明">
                <Textarea
                  rows={2}
                  value={caption}
                  placeholder="例如：上學期簽到卡 第 1 頁"
                  onChange={(e) => setCaption(e.target.value)}
                />
              </Field>
            )}
          </>
        )}
      </Sheet>
    </>
  )
}

function formatMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024)).toLocaleString('zh-TW')} MB`
}

/**
 * Blob → object URL，元件卸載或 Blob 換掉時一定 revoke。
 * 紀錄本可能有上百張縮圖，漏掉 revoke 會讓記憶體一路累積到 iOS 把頁面殺掉。
 */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => {
      URL.revokeObjectURL(u)
      setUrl(null)
    }
  }, [blob])
  return url
}

function Thumb({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob)
  return <span className={s.thumb}>{url !== null && <img src={url} alt="" loading="lazy" />}</span>
}

/** 全螢幕檢視原圖（≤2000px），才看得清紙本上的手寫字跡。 */
function Viewer({
  photoId,
  onClose,
  onDeleted,
}: {
  photoId: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const url = useObjectUrl(photo?.blob ?? null)

  useEffect(() => {
    void getPhoto(photoId).then((p) => setPhoto(p ?? null))
  }, [photoId])

  return (
    <div className={s.viewer} role="dialog" aria-modal="true" aria-label="檢視照片">
      <div className={s.viewerBar}>
        <Button variant="ghost" iconOnly aria-label="關閉" onClick={onClose}>
          <IconClose size={22} />
        </Button>
        <span className={s.viewerSpacer} />
        <Button variant="ghost" iconOnly aria-label="刪除" onClick={() => setConfirmingDelete(true)}>
          <IconTrash size={20} />
        </Button>
      </div>
      <div className={s.viewerStage}>{url !== null && <img src={url} alt="原尺寸照片" />}</div>
      {photo && (
        <div className={s.viewerInfo}>
          <div className={s.viewerDate}>{formatDateLong(photo.recordDate)}</div>
          {photo.caption !== '' && <p className={s.viewerCaption}>{photo.caption}</p>}
        </div>
      )}

      {/* 實體刪除無法復原，一定要二次確認 */}
      <Sheet
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="刪除這張照片？"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void deletePhoto(photoId).then(onDeleted)
              }}
            >
              刪除照片
            </Button>
          </>
        }
      >
        <p className={s.warn}>刪除後無法復原，除非有照片備份。</p>
      </Sheet>
    </div>
  )
}
