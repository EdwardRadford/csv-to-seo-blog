// Readers for single cell values. Used by profiling (to guess a column's type)
// and by normalising (to turn the text into numbers and lists).
import type { Currency, SizeBand } from '../types'

const MISSING = new Set(['', 'n/a', 'na', '-', '–', '—', 'none', 'null', 'unknown', '?', 'tbc', 'not disclosed', 'undisclosed'])

export const isMissing = (value: string) => MISSING.has(value.trim().toLowerCase())

const UNITS: Record<string, number> = {
  k: 1e3, thousand: 1e3,
  m: 1e6, mn: 1e6, mm: 1e6, million: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9
}
const SYMBOLS: Record<string, Currency> = { '£': 'GBP', '$': 'USD', '€': 'EUR' }

// Optional symbol or code, a number with optional thousands commas, an optional unit, an optional code.
const MONEY = /^(?:(GBP|USD|EUR)\s*)?([£$€])?\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(k|thousand|m|mn|mm|million|b|bn|billion)?\s*(GBP|USD|EUR)?$/i

export interface Money {
  value: number
  currency: Currency | null
  /** True when the text had a currency marker or unit, so it's clearly money. */
  marked: boolean
}

export function parseMoney(text: string): Money | null {
  const match = MONEY.exec(text.trim())
  if (!match) return null
  const [, codeBefore, symbol, whole, fraction, unit, codeAfter] = match
  const base = Number((whole ?? '').replace(/,/g, '') + (fraction ?? ''))
  const value = base * (unit ? UNITS[unit.toLowerCase()]! : 1)
  const code = (codeBefore ?? codeAfter)?.toUpperCase() as Currency | undefined
  const currency = code ?? (symbol ? SYMBOLS[symbol]! : null)
  return { value, currency, marked: Boolean(symbol || unit || code) }
}

// "5-9", "10–24", "1,000-4,999", ">1000", "1000+", "500 to 999"
const BAND = /^([<>]=?)?\s*(\d[\d,]*)\s*(?:(?:-|–|to)\s*(\d[\d,]*)|(\+))?$/i

export function parseBand(text: string): SizeBand | null {
  const trimmed = text.trim()
  const match = BAND.exec(trimmed)
  if (!match) return null
  const [, comparison, low, high, plus] = match
  const a = Number(low!.replace(/,/g, ''))
  // Labels are shown on the page, so en dashes in the data become plain hyphens ("10-24").
  const label = trimmed.replace(/\s*[–—]\s*/g, '-')
  if (comparison?.startsWith('<')) return { label, min: 0, max: a }
  if (comparison?.startsWith('>') || plus) return { label, min: a, max: null }
  if (high) return { label, min: a, max: Number(high.replace(/,/g, '')) }
  return { label, min: a, max: a }
}

export const isBandLike = (text: string) => /[-–+<>]|\bto\b/.test(text) && parseBand(text) !== null

export const isPlainNumber = (text: string) => /^-?\d[\d,]*(\.\d+)?$/.test(text.trim())

export const isYear = (text: string) => /^(18|19|20)\d{2}$/.test(text.trim())

export const isDate = (text: string) =>
  /^\d{4}-\d{2}(-\d{2})?$/.test(text.trim()) || /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(text.trim())

// The last label must contain letters ("co.uk", "ai"), so a number like "181.9" is never a URL.
const URL_LIKE = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z][a-z0-9-]*(:\d+)?(\/\S*)?$/i
export const isUrl = (text: string) => URL_LIKE.test(text.trim())

export function normaliseUrl(text: string): string | null {
  const trimmed = text.trim()
  if (!isUrl(trimmed)) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** The separators a list column might use, most specific first. */
export const LIST_SEPARATORS = [';', '|', ',']

export function splitList(text: string, separator: string): string[] {
  return text.split(separator).map((part) => part.trim()).filter((part) => part && !isMissing(part))
}

/** "VENTURE" becomes "Venture"; anything with mixed case is left alone. */
export function tidyLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed === trimmed.toUpperCase() || trimmed === trimmed.toLowerCase()) {
    return trimmed.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase())
  }
  return trimmed
}
