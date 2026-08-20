import { describe, expect, it } from 'vitest'
import { csvFile, toCsv } from './csv'

describe('CSV 逃逸', () => {
  it('一般欄位不加引號', () => {
    expect(toCsv(['a', 'b'], [['1', '2']])).toBe('a,b\r\n1,2')
  })

  it('含逗號的欄位要被引號包住', () => {
    // 名字裡有逗號會讓整列往後偏一格，而且不會有任何錯誤訊息
    expect(toCsv(['姓名'], [['王, 小明']])).toBe('姓名\r\n"王, 小明"')
  })

  it('欄位內的引號要成對重複', () => {
    expect(toCsv(['備註'], [['他說「"很好"」']])).toBe('備註\r\n"他說「""很好""」"')
  })

  it('含換行的欄位要被引號包住', () => {
    expect(toCsv(['備註'], [['第一行\n第二行']])).toBe('備註\r\n"第一行\n第二行"')
  })

  it('空欄位保持為空', () => {
    expect(toCsv(['a', 'b'], [['', 'x']])).toBe('a,b\r\n,x')
  })

  it('中文與金額不需逃逸', () => {
    expect(toCsv(['課程', '金額'], [['素描', '1000']])).toBe('課程,金額\r\n素描,1000')
  })
})

describe('CSV 檔案', () => {
  it('以 UTF-8 BOM 位元組開頭，Excel 才不會把中文讀成亂碼', async () => {
    const file = csvFile('t.csv', '姓名\r\n陳小美')
    // 必須檢查原始位元組：File.text() 解碼時會依規範自動剝除 BOM，用它永遠驗不到
    const bytes = new Uint8Array(await file.arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('BOM 之後就是原始內容', async () => {
    const file = csvFile('t.csv', '姓名\r\n陳小美')
    expect(await file.text()).toBe('姓名\r\n陳小美')
  })
})
