import Papa from 'papaparse'
import type { ParsedCsv } from '../types'

export const MAX_BYTES = 1_000_000
export const MAX_ROWS = 2_000
export const MAX_COLUMNS = 60

export class CsvError extends Error {}

/**
 * Reads CSV text into headers and rows of trimmed strings.
 * Papa Parse guesses the delimiter, so semicolon and tab files work too.
 * Blank rows are dropped and short rows are padded, so every row lines up with the headers.
 */
export function parseCsv(text: string): ParsedCsv {
  if (new TextEncoder().encode(text).length > MAX_BYTES) {
    throw new CsvError(`The file is over ${MAX_BYTES / 1_000_000} MB.`)
  }
  const clean = text.replace(/^﻿/, '')
  if (!clean.trim()) throw new CsvError('The file is empty.')

  const result = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' })
  const [headerRow, ...body] = result.data
  if (!headerRow || headerRow.length < 2) {
    throw new CsvError('Could not find at least two columns. Is this a CSV file?')
  }

  if (headerRow.length > MAX_COLUMNS) {
    throw new CsvError(`The file has ${headerRow.length} columns. The limit is ${MAX_COLUMNS}.`)
  }
  const headers = headerRow.map((h, i) => h.trim() || `Column ${i + 1}`)
  const warnings: string[] = []
  if (body.length === 0) throw new CsvError('The file has a header row but no data.')
  if (body.length > MAX_ROWS) {
    throw new CsvError(`The file has ${body.length} rows. The limit is ${MAX_ROWS}.`)
  }

  let ragged = 0
  const rows = body.map((row) => {
    if (row.length !== headers.length) ragged++
    return headers.map((_, i) => (row[i] ?? '').trim())
  })
  if (ragged) warnings.push(`${ragged} ${ragged === 1 ? 'row had' : 'rows had'} a different number of cells from the header and ${ragged === 1 ? 'was' : 'were'} lined up.`)

  return { headers, rows, delimiter: result.meta.delimiter, warnings }
}
