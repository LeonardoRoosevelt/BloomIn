import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/*
 * jsdom 環境的補丁，只補「jsdom 沒有、但真實瀏覽器一定有」的能力。
 */

// jsdom 的 Blob 無法被 Node 的 structuredClone 複製，存進 fake-indexeddb 後會變成空物件。
// 換回 Node 原生的 Blob/File，行為才與瀏覽器的 IndexedDB 一致（Blob 可完整存取）。
globalThis.Blob = NodeBlob as unknown as typeof Blob
globalThis.File = NodeFile as unknown as typeof File

// jsdom 沒有實作 <dialog> 的 showModal/close；Sheet 依賴它們開關。
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false
}

// vitest 未開 globals，Testing Library 不會自動清理 DOM
afterEach(() => cleanup())
