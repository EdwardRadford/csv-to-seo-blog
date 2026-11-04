import type { Currency } from './types'

const SYMBOL: Record<Currency, string> = { GBP: '£', USD: '$', EUR: '€' }

/** Beauhurst house style: £3.54b, £847m, £30.3m, £250k (three significant figures). */
export function compactMoney(value: number, currency: Currency): string {
  const symbol = SYMBOL[currency]
  const [divisor, unit] = value >= 1e9 ? [1e9, 'b'] : value >= 1e6 ? [1e6, 'm'] : value >= 1e3 ? [1e3, 'k'] : [1, '']
  const scaled = value / divisor
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
  return `${symbol}${Number(scaled.toFixed(digits))}${unit}`
}

/** Full amount for the table, e.g. £30,314,247. */
export function fullMoney(value: number, currency: Currency): string {
  return `${SYMBOL[currency]}${Math.round(value).toLocaleString('en-GB')}`
}

export const percent = (share: number) => `${Math.round(share * 100)}%`

export const count = (value: number) => value.toLocaleString('en-GB')

/** A column header as readers should see it: "total_funding_usd" becomes "Total funding", "Amount Raised (GBP)" becomes "Amount raised". */
export function metricLabel(header: string): string {
  const clean = header
    .replace(/\(.*?\)/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(gbp|usd|eur)\b/gi, ' ')
    .replace(/[£$€]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  // A bare verb or noun reads badly in a sentence ("ranked by raised"), so give it a noun phrase.
  const bare: Record<string, string> = { raised: 'amount raised', funding: 'total funding', amount: 'amount raised', funds: 'total funding', investment: 'total investment' }
  const label = bare[clean] ?? clean
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Funding'
}

/** "1 company", "3 companies". */
export const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

const ACRONYMS = new Set(['ai', 'iot', 'ml', 'vr', 'ar', 'saas', 'b2b', 'b2c', 'esg', 'uk', 'eu', 'us', 'usa'])
/** Industry words as they read in a sentence: "fintech" stays lower case, "ai" becomes "AI". */
export const sentenceCase = (text: string) => text.replace(/[\p{L}\d]+/gu, (w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w))

/** "top-100-seed-fintech-companies-uk" from any title-like text. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}
