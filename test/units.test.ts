import { describe, expect, it } from 'vitest'
import { analyseCsv, datasetFromCsv } from '#shared/csv'
import { headerMultiplier } from '#shared/csv/profile'
import { metricLabel } from '#shared/format'

describe('units written in the header', () => {
  it('reads the multiplier from common header styles', () => {
    expect(headerMultiplier('Funding to date (£m)')).toBe(1e6)
    expect(headerMultiplier('Total raised (GBP millions)')).toBe(1e6)
    expect(headerMultiplier('Raised (£bn)')).toBe(1e9)
    expect(headerMultiplier('Revenue (£000s)')).toBe(1e3)
    expect(headerMultiplier('Total Raised')).toBe(1)
    expect(headerMultiplier('Amount Raised (GBP)')).toBe(1)
  })

  it('scales plain values but not values that carry their own unit', () => {
    const csv = 'Organisation,Funding to date (£m)\nAlpha,12.5\nBeta,£3m\nGamma,0.8\n'
    const { match, profiles } = analyseCsv(csv)
    expect(match.mapping.amount).toBe(1)
    expect(profiles[1]!.currency).toBe('GBP')
    const data = datasetFromCsv(csv)
    expect(data.companies.map((c) => [c.name, c.amount])).toEqual([['Alpha', 12_500_000], ['Beta', 3_000_000], ['Gamma', 800_000]])
    expect(metricLabel('Funding to date (£m)')).toBe('Funding to date')
  })
})

describe('a layout none of the samples use', () => {
  // Same shape as the unseen rehearsal file: decimal millions, "Year est.", a deal column.
  const csv = [
    'Organisation,HQ,Funding to date (£m),Staff count,Year est.,Sector tags,Homepage,Summary,Last deal',
    'Quanta Omics,Glasgow,181.9,1-10,2011,"Cell therapy, Vaccines",quantaomics.co.uk,Quanta develops cell therapies.,Grant',
    'Peregrine Cell,Bristol,165.3,500+,2015,"Synthetic biology, Diagnostics",peregrinecell.co.uk,Peregrine builds diagnostics.,Series B',
    'Helix Bio,Cambridge,12.4,11-50,2019,Oncology,helixbio.co.uk,Helix targets cancers.,Series A',
    'Arden Labs,Oxford,0.6,1-10,2022,Gene therapy,ardenlabs.co.uk,Arden edits genes.,Seed'
  ].join('\n')

  it('never mistakes a decimal number for a website', () => {
    const { profiles } = analyseCsv(csv)
    expect(profiles[2]!.type).toBe('number')
    expect(profiles[6]!.type).toBe('url')
  })

  it('finds every column from the rules alone', () => {
    const { csv: parsed, match } = analyseCsv(csv)
    const h = (role: keyof typeof match.mapping) => (match.mapping[role] === null ? null : parsed.headers[match.mapping[role]!])
    expect(h('name')).toBe('Organisation')
    expect(h('amount')).toBe('Funding to date (£m)')
    expect(h('region')).toBe('HQ')
    expect(h('size')).toBe('Staff count')
    expect(h('founded')).toBe('Year est.')
    expect(h('tags')).toBe('Sector tags')
    expect(h('website')).toBe('Homepage')
    expect(h('description')).toBe('Summary')
    expect(h('stage')).toBe('Last deal')
    const data = datasetFromCsv(csv)
    expect(data.companies[0]).toMatchObject({ name: 'Quanta Omics', amount: 181_900_000, founded: 2011, stage: 'Grant' })
    expect(data.companies[3]!.amount).toBe(600_000)
  })
})
