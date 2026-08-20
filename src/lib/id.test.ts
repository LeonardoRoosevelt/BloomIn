import { describe, expect, it, vi, afterEach } from 'vitest'
import { newId } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('產生合法的 UUID v4', () => {
    expect(newId()).toMatch(UUID_V4)
  })

  it('在沒有 crypto.randomUUID 的情境下仍能產生合法 UUID', () => {
    // 區網 HTTP 測試時瀏覽器不提供 randomUUID；少了備援會讓 App 一開啟就白畫面
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    expect(newId()).toMatch(UUID_V4)
  })

  it('備援路徑不會產生重複值', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const ids = new Set(Array.from({ length: 1000 }, newId))
    expect(ids.size).toBe(1000)
  })
})
