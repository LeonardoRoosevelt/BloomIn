import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../domain/types'
import { buildBackup } from '../store/backup'
import { BackupPanel } from './BackupPanel'

/** 瀏覽器寫入 kv 的 state 時發生錯誤（回復點等其他 key 照常寫入）。 */
function failStateWrites() {
  const realPut = IDBObjectStore.prototype.put
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (args[1] === 'state') throw new DOMException('Internal error writing to the database.', 'UnknownError')
    return realPut.apply(this, args)
  })
}

let unhandled: unknown[]
const onUnhandled = (reason: unknown) => unhandled.push(reason)

afterEach(() => {
  vi.restoreAllMocks()
  process.off('unhandledRejection', onUnhandled)
})

async function restoreBackupFile() {
  const text = JSON.stringify(buildBackup(createInitialState(), new Date('2026-09-28T10:00:00Z')))
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  fireEvent.change(input, { target: { files: [new File([text], 'backup.json', { type: 'application/json' })] } })
  fireEvent.click(await screen.findByRole('button', { name: '覆蓋並還原' }))
}

describe('資料備份區', () => {
  it('還原時存檔失敗不會顯示已還原（Error Handling）：還原資料備份', async () => {
    unhandled = []
    process.on('unhandledRejection', onUnhandled)
    render(<BackupPanel />)
    failStateWrites()

    await restoreBackupFile()

    expect(await screen.findByText(/還原的資料沒有存進裝置：.*Internal error writing to the database\./)).toBeTruthy()
    expect(screen.queryByText(/已還原/)).toBeNull()
    expect(unhandled).toEqual([])
  })

  it('還原時存檔失敗不會顯示已還原（Error Handling）：復原到匯入之前', async () => {
    unhandled = []
    process.on('unhandledRejection', onUnhandled)
    render(<BackupPanel />)
    // 先成功還原一次，才有「復原到匯入之前」可按
    await restoreBackupFile()
    await screen.findByText(/已還原/)
    failStateWrites()

    fireEvent.click(screen.getByRole('button', { name: '復原到匯入之前' }))

    expect(await screen.findByText(/還原的資料沒有存進裝置：.*Internal error writing to the database\./)).toBeTruthy()
    expect(screen.queryByText(/已復原/)).toBeNull()
    expect(unhandled).toEqual([])
  })
})
