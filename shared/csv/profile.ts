import type { ColumnProfile, ColumnType, Currency, ParsedCsv } from '../types'
import { isBandLike, isDate, isMissing, isPlainNumber, isUrl, isYear, LIST_SEPARATORS, parseBand, parseMoney, splitList } from './values'

// A column takes a type when at least this share of its filled cells fit it.
const FIT = 0.8

const share = (values: string[], test: (v: string) => boolean) =>
  values.length ? values.filter(test).length / values.length : 0

const average = (numbers: number[]) => (numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0)

function listSeparator(values: string[]): string | undefined {
  for (const separator of LIST_SEPARATORS) {
    const withSeparator = values.filter((v) => v.includes(separator))
    if (withSeparator.length / values.length < 0.2) continue
    // Lists are made of short labels. Prose with commas in it is not a list.
    const parts = values.flatMap((v) => splitList(v, separator))
    if (average(parts.map((p) => p.length)) <= 35 && average(values.map((v) => v.length)) <= 140) return separator
  }
  return undefined
}

function mainCurrency(values: string[], header: string): Currency | undefined {
  const counts: Record<string, number> = {}
  for (const value of values) {
    const currency = parseMoney(value)?.currency
    if (currency) counts[currency] = (counts[currency] ?? 0) + 1
  }
  const fromValues = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Currency | undefined
  if (fromValues) return fromValues
  const code = /\b(gbp|usd|eur)\b/i.exec(header)?.[1]
  if (code) return code.toUpperCase() as Currency
  const symbol = /[£$€]/.exec(header)?.[0]
  return symbol ? ({ '£': 'GBP', '$': 'USD', '€': 'EUR' } as const)[symbol as '£' | '$' | '€'] : undefined
}

/**
 * The unit a header puts on plain numbers: "Funding (£m)" means 12.5 is £12.5m.
 * Values that carry their own unit ("£12.5m") are not multiplied again.
 */
export function headerMultiplier(header: string): number {
  const h = header.toLowerCase()
  if (/\(\s*[£$€]?\s*(bn|b)\s*\)|\bbillions?\b|[£$€]\s?bn\b/.test(h)) return 1e9
  if (/\(\s*[£$€]?\s*(m|mn)\s*\)|\bmillions?\b|[£$€]\s?m\b/.test(h)) return 1e6
  if (/\(\s*[£$€]?\s*(k|000s?)\s*\)|\bthousands?\b|\b000s\b/.test(h)) return 1e3
  return 1
}

function columnType(values: string[]): ColumnType {
  if (values.length === 0) return 'empty'
  if (share(values, isUrl) >= FIT) return 'url'
  if (share(values, isYear) >= FIT) return 'year'
  if (share(values, isDate) >= FIT) return 'date'
  const money = values.map(parseMoney)
  if (share(values, (v) => parseMoney(v) !== null) >= FIT && money.some((m) => m?.marked)) return 'money'
  if (share(values, isPlainNumber) >= FIT) return 'number'
  if (share(values, (v) => parseBand(v) !== null) >= FIT && values.some(isBandLike)) return 'band'
  if (listSeparator(values)) return 'list'
  const distinct = new Set(values.map((v) => v.toLowerCase())).size
  if (distinct <= Math.max(12, values.length * 0.5) && average(values.map((v) => v.length)) <= 40) return 'category'
  return 'text'
}

/** Works out what each column holds, without looking at its header. */
export function profileColumns(csv: ParsedCsv): ColumnProfile[] {
  return csv.headers.map((header, index) => {
    const all = csv.rows.map((row) => row[index] ?? '')
    const values = all.filter((v) => !isMissing(v))
    const type = columnType(values)
    const profile: ColumnProfile = {
      header,
      index,
      type,
      filled: all.length ? values.length / all.length : 0,
      count: values.length,
      distinct: new Set(values.map((v) => v.toLowerCase())).size,
      examples: [...new Set(values)].slice(0, 3)
    }
    if (type === 'money' || type === 'number') {
      const currency = mainCurrency(values, header)
      if (currency) profile.currency = currency
    }
    if (type === 'list') profile.separator = listSeparator(values)
    return profile
  })
}
