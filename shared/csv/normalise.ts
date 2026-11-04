import type { ColumnProfile, Company, Currency, Dataset, Mapping, ParsedCsv, Role } from '../types'
import { ROLES } from '../types'
import { CsvError } from './parse'
import { plural } from '../format'
import { headerMultiplier } from './profile'
import { isMissing, isPlainNumber, isYear, normaliseUrl, parseBand, parseMoney, splitList, tidyLabel } from './values'

/**
 * Turns parsed rows into clean company records using the column mapping.
 * Everything downstream (stats, AI prompt, template) reads these records,
 * never the raw CSV, so a new column layout only has to be handled here.
 */
export function buildDataset(csv: ParsedCsv, profiles: ColumnProfile[], mapping: Mapping): Dataset {
  if (mapping.name === null) throw new CsvError('No company name column was found.')
  const warnings = [...csv.warnings]
  const cell = (row: string[], role: Role) => {
    const index = mapping[role]
    if (index === null) return null
    const value = row[index] ?? ''
    return isMissing(value) ? null : value
  }
  const tagSeparator = mapping.tags !== null ? profiles[mapping.tags]?.separator : undefined
  const amountMultiplier = mapping.amount !== null ? headerMultiplier(csv.headers[mapping.amount] ?? '') : 1

  const seen = new Set<string>()
  let duplicates = 0
  let missingAmounts = 0
  const records: (Company & { sourceRank: number | null })[] = []

  for (const row of csv.rows) {
    const name = cell(row, 'name')?.replace(/\s+/g, ' ')
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) { duplicates++; continue }
    seen.add(key)

    const amountText = cell(row, 'amount')
    const money = amountText ? parseMoney(amountText) : null
    // A plain "12.5" under "Funding (£m)" is £12.5m; "£12.5m" already says so itself.
    const amount = money ? money.value * (money.marked && /[kmb]|million|billion|thousand/i.test(amountText!) ? 1 : amountMultiplier) : null
    if (mapping.amount !== null && amount === null) missingAmounts++

    const rankText = cell(row, 'rank')
    const sizeText = cell(row, 'size')
    const tagsText = cell(row, 'tags')
    const foundedText = cell(row, 'founded')
    const region = cell(row, 'region')
    const stage = cell(row, 'stage')

    records.push({
      rank: 0,
      sourceRank: rankText && isPlainNumber(rankText) ? Number(rankText.replace(/,/g, '')) : null,
      name,
      amount,
      region: region ? tidyLabel(region) : null,
      stage: stage ? tidyLabel(stage) : null,
      size: sizeText ? parseBand(sizeText) : null,
      description: cell(row, 'description'),
      website: (() => { const w = cell(row, 'website'); return w ? normaliseUrl(w) : null })(),
      tags: tagsText ? (tagSeparator ? splitList(tagsText, tagSeparator) : [tagsText.trim()]) : [],
      founded: foundedText && isYear(foundedText) ? Number(foundedText) : null
    })
  }
  if (records.length === 0) throw new CsvError('No rows had a company name.')
  if (duplicates) warnings.push(`${plural(duplicates, 'duplicate company row was', 'duplicate company rows were')} removed.`)
  if (missingAmounts) warnings.push(`${plural(missingAmounts, 'company has', 'companies have')} no usable amount and ${missingAmounts === 1 ? 'is' : 'are'} ranked last.`)

  // Use the file's own ranking when every row has one; otherwise rank by amount, highest first.
  const rankedByAmount = mapping.rank === null || records.some((r) => r.sourceRank === null)
  if (rankedByAmount) {
    records.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1))
    records.forEach((r, i) => { r.rank = i + 1 })
    if (mapping.rank !== null) warnings.push('Some rows had no rank, so all rows were ranked by amount instead.')
  } else {
    records.sort((a, b) => a.sourceRank! - b.sourceRank!)
    records.forEach((r) => { r.rank = r.sourceRank! })
  }

  const companies: Company[] = records.map(({ sourceRank: _, ...company }) => company)
  const has = Object.fromEntries(ROLES.map((role) => [role, companies.some((c) => hasValue(c, role))])) as Dataset['has']
  has.rank = true
  const columns: Dataset['columns'] = {}
  for (const role of ROLES) {
    const index = mapping[role]
    if (index !== null) columns[role] = csv.headers[index]
  }

  return { companies, currency: currencyOf(profiles, mapping), has, columns, warnings, rankedByAmount }
}

function hasValue(company: Company, role: Role): boolean {
  switch (role) {
    case 'tags': return company.tags.length > 0
    case 'rank': return true
    default: return company[role] !== null
  }
}

function currencyOf(profiles: ColumnProfile[], mapping: Mapping): Currency {
  return (mapping.amount !== null ? profiles[mapping.amount]?.currency : undefined) ?? 'GBP'
}
