/**
 * Gujarati numeral helpers.
 *
 * The paper register is written in Gujarati numerals (૦-૯), so standards, counts and
 * serial numbers read naturally to a clerk when shown that way. GR numbers and dates
 * stay in Western digits on purpose: those are identifiers people search and type.
 */

const GU_DIGITS = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯']

/** 5 → "૫", "12" → "૧૨". Non-digits are passed through untouched. */
export function toGujaratiDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\d/g, (d) => GU_DIGITS[Number(d)])
}

/** Standards present in a Gujarat primary/secondary register. */
export const STANDARDS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

/** "5" → "ધો. ૫" — the way a standard is written in the register. */
export function formatStandard(std: string | null | undefined): string {
  if (!std) return ''
  return `ધો. ${toGujaratiDigits(std)}`
}

/**
 * Register dates are read day-first. Stored values are ISO (YYYY-MM-DD), so render
 * them as DD-MM-YYYY to match what is written on the page.
 */
export function formatRegisterDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}-${m[2]}-${m[1]}`
}
