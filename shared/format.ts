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
