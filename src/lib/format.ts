/** 金額一律顯示為整數台幣，與計費引擎的四捨五入結果一致。 */
export function formatMoney(amount: number): string {
  return `NT$${amount.toLocaleString('zh-TW')}`
}
