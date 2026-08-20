import { describe, expect, it } from 'vitest'
import {
  computeBilling,
  formatMinutes,
  resolveRate,
  roundMinutes,
  validateTimeWindow,
  type BillingInput,
} from './billing'

/**
 * 基準情境：素描班 16:00–18:00（兩小時），課程費率 600 元/小時，精確計時。
 * 每個測試只改動與該規則相關的欄位，斷言的是最終金額，不是函式有沒有被呼叫。
 */
function scenario(patch: {
  attendance?: Partial<BillingInput['attendance']>
  session?: Partial<BillingInput['session']>
  student?: Partial<BillingInput['student']>
  courseType?: BillingInput['courseType']
  settings?: Partial<BillingInput['settings']>
} = {}): BillingInput {
  return {
    attendance: {
      status: 'present',
      actualStart: null,
      actualEnd: null,
      manualAmountOverride: null,
      ...patch.attendance,
    },
    session: { startTime: '16:00', endTime: '18:00', ...patch.session },
    student: { hourlyRateOverride: null, ...patch.student },
    courseType:
      patch.courseType === undefined
        ? { hourlyRate: 600, chargeOnAbsence: false }
        : patch.courseType,
    settings: { defaultHourlyRate: 500, rounding: 'exact', ...patch.settings },
  }
}

describe('費率解析優先序', () => {
  it('學生個別費率蓋過課程類型費率', () => {
    const r = computeBilling(scenario({ student: { hourlyRateOverride: 800 } }))
    expect(r.appliedRate).toBe(800)
    expect(r.amount).toBe(1600)
  })

  it('學生未設定時，用課程類型費率', () => {
    expect(computeBilling(scenario()).amount).toBe(1200)
  })

  it('課程類型不存在時，退回全域預設費率', () => {
    const r = computeBilling(scenario({ courseType: null }))
    expect(r.appliedRate).toBe(500)
    expect(r.amount).toBe(1000)
  })

  it('免費生（費率 0）不會被誤判為未設定而套用課程費率', () => {
    // 這是 ?? 與 || 的差別：用 || 會讓 0 被當成 falsy 而收到 1200 元
    const r = computeBilling(scenario({ student: { hourlyRateOverride: 0 } }))
    expect(r.appliedRate).toBe(0)
    expect(r.amount).toBe(0)
  })

  it('resolveRate 可獨立使用於預覽費率', () => {
    expect(resolveRate({ hourlyRateOverride: null }, { hourlyRate: 700 }, { defaultHourlyRate: 500 })).toBe(700)
    expect(resolveRate({ hourlyRateOverride: null }, null, { defaultHourlyRate: 500 })).toBe(500)
  })
})

describe('時數進位規則', () => {
  it('exact 照實際分鐘計費', () => {
    // 16:00–17:35 = 95 分鐘 × 600/60 = 950 元
    const r = computeBilling(scenario({ session: { startTime: '16:00', endTime: '17:35' } }))
    expect(r.billedMinutes).toBe(95)
    expect(r.amount).toBe(950)
  })

  it('nearest15 對 95 分鐘四捨五入為 90 分鐘', () => {
    const r = computeBilling(
      scenario({ session: { startTime: '16:00', endTime: '17:35' }, settings: { rounding: 'nearest15' } }),
    )
    expect(r.billedMinutes).toBe(90)
    expect(r.amount).toBe(900)
  })

  it('nearest15 對 98 分鐘進位為 105 分鐘', () => {
    const r = computeBilling(
      scenario({ session: { startTime: '16:00', endTime: '17:38' }, settings: { rounding: 'nearest15' } }),
    )
    expect(r.billedMinutes).toBe(105)
  })

  it('nearest30 下遲到 5 分鐘不會被多扣半小時', () => {
    // 16:05–18:00 = 115 分鐘，四捨五入到 120 分鐘（而非無條件進位到 150）
    const r = computeBilling(
      scenario({
        attendance: { status: 'late', actualStart: '16:05' },
        settings: { rounding: 'nearest30' },
      }),
    )
    expect(r.billedMinutes).toBe(120)
    expect(r.amount).toBe(1200)
  })

  it('roundMinutes 可獨立使用', () => {
    expect(roundMinutes(95, 'exact')).toBe(95)
    expect(roundMinutes(95, 'nearest15')).toBe(90)
    expect(roundMinutes(95, 'nearest30')).toBe(90)
    expect(roundMinutes(105, 'nearest30')).toBe(120)
  })
})

describe('實際起訖時間', () => {
  it('早退只收實際上課時數', () => {
    // 16:00–17:00，只上了一小時
    const r = computeBilling(scenario({ attendance: { actualEnd: '17:00' } }))
    expect(r.billedMinutes).toBe(60)
    expect(r.amount).toBe(600)
  })

  it('未填實際時間時沿用該堂課的排定時間', () => {
    expect(computeBilling(scenario()).billedMinutes).toBe(120)
  })

  it('遲到照實際到課時間計費，不因狀態不同而改變算法', () => {
    const late = computeBilling(scenario({ attendance: { status: 'late', actualStart: '16:30' } }))
    const present = computeBilling(scenario({ attendance: { status: 'present', actualStart: '16:30' } }))
    expect(late).toEqual(present)
    expect(late.amount).toBe(900)
  })
})

describe('缺席計費', () => {
  it('無故缺席預設不收費', () => {
    const r = computeBilling(scenario({ attendance: { status: 'absent' } }))
    expect(r.billedMinutes).toBe(0)
    expect(r.amount).toBe(0)
  })

  it('課程類型設定為缺席照收時，按排定時數收費', () => {
    const r = computeBilling(
      scenario({
        attendance: { status: 'absent' },
        courseType: { hourlyRate: 600, chargeOnAbsence: true },
      }),
    )
    expect(r.billedMinutes).toBe(120)
    expect(r.amount).toBe(1200)
  })

  it('事先請假一律不收費，即使課程設定為缺席照收', () => {
    // 這是 excused 與 absent 存在兩個狀態的唯一理由，改壞這條規則會直接向請假學生收錢
    const r = computeBilling(
      scenario({
        attendance: { status: 'excused' },
        courseType: { hourlyRate: 600, chargeOnAbsence: true },
      }),
    )
    expect(r.amount).toBe(0)
  })

  it('缺席照收時忽略殘留的實際時間欄位', () => {
    const r = computeBilling(
      scenario({
        attendance: { status: 'absent', actualStart: '16:00', actualEnd: '16:10' },
        courseType: { hourlyRate: 600, chargeOnAbsence: true },
      }),
    )
    expect(r.billedMinutes).toBe(120)
  })
})

describe('手動指定金額', () => {
  it('覆寫金額凌駕費率計算，但時數仍照實際計算', () => {
    const r = computeBilling(scenario({ attendance: { manualAmountOverride: 300 } }))
    expect(r.amount).toBe(300)
    expect(r.billedMinutes).toBe(120)
  })

  it('覆寫為 0（本堂免收）有效，不會退回費率計算', () => {
    const r = computeBilling(scenario({ attendance: { manualAmountOverride: 0 } }))
    expect(r.amount).toBe(0)
  })
})

describe('非法時間輸入', () => {
  it('結束早於開始時計為 0，不產生負數金額', () => {
    const r = computeBilling(scenario({ session: { startTime: '18:00', endTime: '16:00' } }))
    expect(r.billedMinutes).toBe(0)
    expect(r.amount).toBe(0)
  })

  it('不支援跨午夜：18:00→02:00 視為錯誤而非 8 小時', () => {
    // 若自動加 24 小時，一個打錯的時間會變成一筆 4800 元的帳單
    const r = computeBilling(scenario({ session: { startTime: '18:00', endTime: '02:00' } }))
    expect(r.amount).toBe(0)
  })

  it('時間格式錯誤時計為 0', () => {
    const r = computeBilling(scenario({ session: { startTime: '', endTime: '18:00' } }))
    expect(r.amount).toBe(0)
  })

  it('validateTimeWindow 讓表單能在存檔前擋下錯誤', () => {
    expect(validateTimeWindow('16:00', '18:00')).toBeNull()
    expect(validateTimeWindow('18:00', '16:00')).toBe('結束時間必須晚於開始時間')
    expect(validateTimeWindow('18:00', '18:00')).toBe('結束時間必須晚於開始時間')
    expect(validateTimeWindow('25:00', '18:00')).toBe('開始時間格式不正確')
    expect(validateTimeWindow('16:00', '16:99')).toBe('結束時間格式不正確')
  })
})

describe('金額進位', () => {
  it('元以下四捨五入，不留小數', () => {
    // 50 分鐘 × 700/60 = 583.33… → 583 元
    const r = computeBilling(
      scenario({ session: { startTime: '16:00', endTime: '16:50' }, courseType: { hourlyRate: 700, chargeOnAbsence: false } }),
    )
    expect(r.amount).toBe(583)
    expect(Number.isInteger(r.amount)).toBe(true)
  })
})

describe('時數顯示', () => {
  it('依長度切換顯示格式', () => {
    expect(formatMinutes(45)).toBe('45 分')
    expect(formatMinutes(120)).toBe('2 小時')
    expect(formatMinutes(95)).toBe('1 小時 35 分')
  })
})
