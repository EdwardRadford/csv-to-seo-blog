import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { datasetFromCsv } from '#shared/csv'
import { checkCopy, fallbackCopy, numbersIn, pageTitle, type PageCopy, type Subject } from '#shared/copy'
import { computeStats, factsFrom } from '#shared/stats'

const sample = (name: string) => readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf8')
const data = datasetFromCsv(sample('fintech-uk-seed-top-100.csv'))
const stats = computeStats(data, new Date('2026-11-04'))
const facts = factsFrom(stats, { metric: 'Total Raised' })
const subject: Subject = { industry: 'fintech', geography: 'UK', qualifier: 'seed-stage', metric: 'Total Raised', year: 2026 }

const goodCopy = (): PageCopy => ({
  metaDescription: 'The top 100 seed-stage fintech companies in the UK, ranked by total raised. Combined, they have £622m, and London is home to 78 of them.',
  intro: 'The 100 best-funded seed-stage fintechs in the UK have £622m between them. Nevis ranks first with £30.3m.',
  overview: ['The top 10 companies account for 33% of the total.'],
  keyFindings: ['London is home to 78 of the companies (78%).', 'The median company has £4.15m.', 'Nevis ranks first with £30.3m.'],
  locations: 'London is home to 78 of the companies.',
  outlook: ['Seed funding is spread thinly beyond the top of the list.'],
  faq: [
    { question: 'Which company ranks first?', answer: 'Nevis, with £30.3m.' },
    { question: 'Where are they based?', answer: 'Mostly London (78).' },
    { question: 'What is the bar for the list?', answer: '£2m.' }
  ]
})

describe('number extraction', () => {
  it('reads units and precision', () => {
    expect(numbersIn('£30.3m and 33% and £622m')).toMatchObject([
      { value: 30_300_000, percent: false },
      { value: 33, percent: true },
      { value: 622_000_000, percent: false }
    ])
  })

  it('ignores digits inside words like B2B or Web3', () => {
    expect(numbersIn('B2B payments and Web3 wallets')).toEqual([])
  })
})

describe('copy checker', () => {
  it('accepts copy that only uses the given figures, including the page year', () => {
    const copy = goodCopy()
    copy.intro += ' This is the 2026 edition.'
    expect(checkCopy(copy, facts, data, [2026])).toEqual({ ok: true, problems: [] })
  })

  it('accepts a coarser rounding of a real figure', () => {
    const copy = goodCopy()
    copy.overview = ['Nevis leads with £30m.']
    expect(checkCopy(copy, facts, data).ok).toBe(true)
  })

  it('rejects an invented or wrongly rounded figure', () => {
    const copy = goodCopy()
    copy.overview = ['Nevis leads with £31m, and 45% of companies are profitable.']
    const result = checkCopy(copy, facts, data)
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toMatch(/£31m/)
    expect(result.problems.join(' ')).toMatch(/45%/)
  })

  it('rejects markdown', () => {
    const copy = goodCopy()
    copy.intro = '**Bold** claims'
    expect(checkCopy(copy, facts, data).problems).toContain('contains markdown or HTML')
  })
})

describe('template copy and title', () => {
  it('the fallback passes its own checker', () => {
    const copy = fallbackCopy(subject, stats, data)
    expect(checkCopy(copy, facts, data, [2026])).toEqual({ ok: true, problems: [] })
  })

  it('the fallback works for a dataset with no regions and dollars', () => {
    const clean = datasetFromCsv(sample('ai-startups-uk.csv'))
    const s = computeStats(clean, new Date('2026-11-04'))
    const copy = fallbackCopy({ ...subject, industry: 'AI', qualifier: null }, s, clean)
    expect(copy.locations).toBeNull()
    expect(checkCopy(copy, factsFrom(s, { metric: 'Total Equity Raised' }), clean, [2026]).ok).toBe(true)
  })

  it('title follows the Beauhurst formula', () => {
    expect(pageTitle(subject, 100)).toBe('Top 100 Seed-Stage Fintech Companies in the UK | 2026')
    expect(pageTitle({ ...subject, geography: 'Europe', qualifier: null, industry: 'cleantech' }, 80)).toBe('Top 80 Cleantech Companies in Europe | 2026')
    expect(pageTitle({ ...subject, qualifier: null, industry: 'ai' }, 30)).toBe('Top 30 AI Companies in the UK | 2026')
  })
})
