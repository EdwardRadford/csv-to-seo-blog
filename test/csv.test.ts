import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyseCsv, CsvError, datasetFromCsv } from '#shared/csv'
import { parseCsv } from '#shared/csv/parse'
import { parseBand, parseMoney, tidyLabel } from '#shared/csv/values'

const sample = (name: string) => readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf8')
const header = (text: string, index: number | null) => (index === null ? null : analyseCsv(text).csv.headers[index])

describe('cell values', () => {
  it('reads money in every format the samples use', () => {
    expect(parseMoney('£30,314,247')).toEqual({ value: 30314247, currency: 'GBP', marked: true })
    expect(parseMoney('$2.5m')?.value).toBe(2_500_000)
    expect(parseMoney('$1.25b')?.value).toBe(1_250_000_000)
    expect(parseMoney('£ 3,400,000')?.value).toBe(3_400_000)
    expect(parseMoney('2.15 million')?.value).toBeCloseTo(2_150_000)
    expect(parseMoney('64328841')).toEqual({ value: 64328841, currency: null, marked: false })
    expect(parseMoney('N/A')).toBeNull()
    expect(parseMoney('Seed')).toBeNull()
  })

  it('reads employee bands', () => {
    expect(parseBand('5-9')).toEqual({ label: '5-9', min: 5, max: 9 })
    expect(parseBand('>1000')).toEqual({ label: '>1000', min: 1000, max: null })
    expect(parseBand('1,000+')).toEqual({ label: '1,000+', min: 1000, max: null })
    expect(parseBand('872')).toEqual({ label: '872', min: 872, max: 872 })
    expect(parseBand('10–24')).toEqual({ label: '10-24', min: 10, max: 24 })
  })

  it('tidies shouted or lower-case labels only', () => {
    expect(tidyLabel('VENTURE')).toBe('Venture')
    expect(tidyLabel('  north west ')).toBe('North West')
    expect(tidyLabel('South East')).toBe('South East')
    expect(tidyLabel('iOS apps')).toBe('iOS apps')
  })
})

describe('parsing', () => {
  it('rejects empty and header-only files', () => {
    expect(() => parseCsv('')).toThrow(CsvError)
    expect(() => parseCsv('a,b\n')).toThrow(CsvError)
  })

  it('handles the messy file: BOM, semicolons, CRLF and a blank row', () => {
    const csv = parseCsv(sample('messy-proptech.csv'))
    expect(csv.delimiter).toBe(';')
    expect(csv.headers[0]).toBe('Company')
    expect(csv.rows.length).toBe(43)
  })
})

describe('column detection on every sample', () => {
  it('fintech: the real dataset', () => {
    const text = sample('fintech-uk-seed-top-100.csv')
    const { match, profiles } = analyseCsv(text)
    const m = match.mapping
    expect(header(text, m.name)).toBe('Company')
    expect(header(text, m.rank)).toBe('Rank')
    expect(header(text, m.amount)).toBe('Total Raised')
    expect(header(text, m.region)).toBe('Region')
    expect(header(text, m.stage)).toBe('Stage')
    expect(header(text, m.size)).toBe('Employees')
    expect(header(text, m.description)).toBe('Description')
    expect(header(text, m.website)).toBe('Website')
    expect(header(text, m.tags)).toBe('Industries')
    expect(m.founded).toBeNull()
    expect(profiles[m.amount!]!.currency).toBe('GBP')
    expect(profiles[m.tags!]!.separator).toBe(';')
  })

  it('healthtech: different header names, plain-number money', () => {
    const text = sample('healthtech-uk-top-50.csv')
    const m = analyseCsv(text).match.mapping
    expect(header(text, m.name)).toBe('Company Name')
    expect(header(text, m.rank)).toBe('Position')
    expect(header(text, m.amount)).toBe('Amount Raised (GBP)')
    expect(header(text, m.region)).toBe('Location')
    expect(header(text, m.stage)).toBe('Funding Stage')
    expect(header(text, m.size)).toBe('Headcount')
    expect(header(text, m.description)).toBe('About')
    expect(header(text, m.website)).toBe('URL')
    expect(header(text, m.tags)).toBe('Sectors')
  })

  it('cleantech: dollars, countries, no rank column', () => {
    const text = sample('cleantech-europe.csv')
    const { match, profiles } = analyseCsv(text)
    const m = match.mapping
    expect(m.rank).toBeNull()
    expect(header(text, m.amount)).toBe('total_funding_usd')
    expect(profiles[m.amount!]!.currency).toBe('USD')
    expect(header(text, m.region)).toBe('country')
    expect(header(text, m.founded)).toBe('founded')
    expect(header(text, m.tags)).toBe('tags')
    expect(profiles[m.tags!]!.separator).toBe('|')
  })

  it('AI startups: extra columns, no location', () => {
    const text = sample('ai-startups-uk.csv')
    const { match } = analyseCsv(text)
    const m = match.mapping
    expect(header(text, m.name)).toBe('Startup')
    expect(header(text, m.amount)).toBe('Total Equity Raised')
    expect(header(text, m.size)).toBe('Team Size')
    expect(header(text, m.founded)).toBe('Year Founded')
    expect(header(text, m.tags)).toBe('Focus Areas')
    expect(m.region).toBeNull()
    expect(m.stage).toBeNull()
    // "Lead Investor" and "Last Round" are left for the AI step to consider.
    expect(match.unmatched.map((i) => header(text, i))).toEqual(expect.arrayContaining(['Lead Investor', 'Last Round']))
  })

  it('messy proptech: still finds its columns', () => {
    const text = sample('messy-proptech.csv')
    const { match, profiles } = analyseCsv(text)
    const m = match.mapping
    expect(header(text, m.name)).toBe('Company')
    expect(header(text, m.amount)).toBe('Raised')
    expect(profiles[m.amount!]!.type).toBe('money')
    expect(header(text, m.region)).toBe('Region')
    expect(header(text, m.size)).toBe('Staff')
    expect(header(text, m.website)).toBe('Site')
  })
})

describe('clean dataset', () => {
  it('fintech keeps the file ranking and parses every amount', () => {
    const data = datasetFromCsv(sample('fintech-uk-seed-top-100.csv'))
    expect(data.companies).toHaveLength(100)
    expect(data.rankedByAmount).toBe(false)
    expect(data.companies[0]).toMatchObject({ rank: 1, name: 'Nevis', amount: 30314247, region: 'London', stage: 'Seed' })
    expect(data.companies.every((c) => c.amount !== null)).toBe(true)
    expect(data.companies[3]!.tags).toEqual(['Application software', 'Banking'])
  })

  it('cleantech is ranked by amount because it has no rank column', () => {
    const data = datasetFromCsv(sample('cleantech-europe.csv'))
    expect(data.rankedByAmount).toBe(true)
    expect(data.currency).toBe('USD')
    const amounts = data.companies.map((c) => c.amount!)
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
    expect(data.companies[0]!.rank).toBe(1)
    expect(data.companies[0]!.website).toMatch(/^https:\/\//)
  })

  it('messy proptech: drops duplicates and blank rows, keeps N/A rows last', () => {
    const data = datasetFromCsv(sample('messy-proptech.csv'))
    expect(data.companies).toHaveLength(40)
    expect(data.warnings.join(' ')).toMatch(/3 duplicate/)
    const last = data.companies.at(-1)!
    expect(last.amount).toBeNull()
    expect(data.companies[0]!.stage).toBe(data.companies[0]!.stage![0] + data.companies[0]!.stage!.slice(1).toLowerCase())
    expect(data.companies.every((c) => c.name === c.name.trim())).toBe(true)
  })

  it('AI startups has no region or stage, and says so', () => {
    const data = datasetFromCsv(sample('ai-startups-uk.csv'))
    expect(data.has.region).toBe(false)
    expect(data.has.stage).toBe(false)
    expect(data.has.founded).toBe(true)
  })
})
