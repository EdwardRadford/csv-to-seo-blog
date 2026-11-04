import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { datasetFromCsv } from '#shared/csv'
import { compactMoney, slugify } from '#shared/format'
import { computeStats, factsFrom } from '#shared/stats'

const sample = (name: string) => readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf8')
const now = new Date('2026-11-04')

describe('formatting', () => {
  it('uses three significant figures, Beauhurst style', () => {
    expect(compactMoney(3_540_000_000, 'GBP')).toBe('£3.54b')
    expect(compactMoney(847_200_000, 'GBP')).toBe('£847m')
    expect(compactMoney(30_314_247, 'GBP')).toBe('£30.3m')
    expect(compactMoney(2_000_000, 'USD')).toBe('$2m')
    expect(compactMoney(250_000, 'EUR')).toBe('€250k')
  })

  it('makes clean slugs', () => {
    expect(slugify('Top 100 Seed-Stage Fintech Companies in the UK | 2026')).toBe('top-100-seed-stage-fintech-companies-in-the-uk-2026')
  })
})

describe('fintech stats match a hand calculation (Python, csv module)', () => {
  const stats = computeStats(datasetFromCsv(sample('fintech-uk-seed-top-100.csv')), now)

  it('totals and averages', () => {
    expect(stats.companies).toBe(100)
    expect(stats.total).toBe(622_301_270)
    expect(stats.mean).toBeCloseTo(6_223_012.7, 1)
    expect(stats.median).toBe(4_146_786)
    expect(stats.threshold).toBe(2_000_000)
    expect(stats.leader).toEqual({ name: 'Nevis', amount: 30_314_247 })
  })

  it('concentration', () => {
    expect(stats.top5Share).toBeCloseTo(0.2027, 4)
    expect(stats.top10Share).toBeCloseTo(0.3300, 4)
  })

  it('groups', () => {
    expect(stats.regions[0]).toMatchObject({ label: 'London', count: 78 })
    expect(stats.regions[1]).toMatchObject({ label: 'North West', count: 6 })
    expect(stats.regions).toHaveLength(10)
    expect(stats.stages).toEqual([expect.objectContaining({ label: 'Seed', count: 100 })])
    expect([...stats.sizes].sort((a, b) => b.count - a.count)[0]).toMatchObject({ label: '10-24', count: 49 })
    expect(stats.sizes[0]!.label).toBe('<5') // ordered smallest band first
    expect(stats.tags[0]).toMatchObject({ label: 'Application software', count: 98 })
    expect(stats.founded).toBeNull()
  })

  it('facts carry the formatted numbers', () => {
    const facts = factsFrom(stats, { metric: 'Total Raised' })
    const text = facts.map((f) => f.text).join(' ')
    expect(text).toContain('£622m')
    expect(text).toContain('33%')
    expect(text).toContain('London is home to 78')
    expect(text).toContain('All 100 companies with a known stage are at Seed stage')
  })
})

describe('stats cope with missing roles', () => {
  it('AI startups: no regions or stages, but founding years', () => {
    const stats = computeStats(datasetFromCsv(sample('ai-startups-uk.csv')), now)
    expect(stats.regions).toEqual([])
    expect(stats.stages).toEqual([])
    expect(stats.founded).not.toBeNull()
    expect(stats.amountBySize).toEqual([]) // team size is a plain number, not a band
  })

  it('messy proptech: totals ignore the N/A amounts', () => {
    const data = datasetFromCsv(sample('messy-proptech.csv'))
    const stats = computeStats(data, now)
    expect(stats.withAmount).toBe(data.companies.filter((c) => c.amount !== null).length)
    expect(stats.withAmount).toBeLessThan(stats.companies)
  })
})
