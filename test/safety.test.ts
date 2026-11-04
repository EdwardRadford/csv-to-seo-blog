import { describe, expect, it } from 'vitest'
import { CsvError, datasetFromCsv } from '#shared/csv'
import { parseCsv } from '#shared/csv/parse'
import { normaliseUrl } from '#shared/csv/values'
import { computeStats } from '#shared/stats'
import type { PageRecord } from '#shared/page'
import { fallbackCopy } from '#shared/copy'
import { reportJsonLd } from '../app/utils/seo'

describe('untrusted input', () => {
  it('only turns plain web addresses into links', () => {
    expect(normaliseUrl('javascript:alert(1)')).toBeNull()
    expect(normaliseUrl('data:text/html,hi')).toBeNull()
    expect(normaliseUrl('example.co.uk')).toBe('https://example.co.uk')
    expect(normaliseUrl('181.9')).toBeNull()
  })

  it('refuses files with too many columns', () => {
    const wide = Array.from({ length: 61 }, (_, i) => `c${i}`).join(',') + '\n' + Array.from({ length: 61 }, () => 'x').join(',')
    expect(() => parseCsv(wide)).toThrow(CsvError)
  })

  it('reports a missing name column as a file problem, not a crash', () => {
    expect(() => datasetFromCsv('a,b\n1,2\n', { name: null, rank: null, amount: 0, region: null, stage: null, size: null, description: null, website: null, tags: null, founded: null })).toThrow(CsvError)
  })
})

describe('structured data', () => {
  const data = datasetFromCsv('Company,Region,Total Raised,Website,Description\nAcme </script><b>,London,£2m,acme.com,Makes things\nBeta,Leeds,£1m,beta.io,Other\n')
  const stats = computeStats(data)
  const subject = { industry: 'test', geography: 'UK', qualifier: null, metric: 'Total raised', year: 2026 }
  const page = {
    slug: 'x', title: 'Top 2 Test Companies in the UK | 2026', subject, createdAt: '2026-11-04T00:00:00Z', updatedAt: '2026-11-04T00:00:00Z', noindex: false,
    source: { filename: 'x.csv', rows: 2, columns: {}, warnings: [] }, data, stats,
    content: { copy: fallbackCopy(subject, stats, data), source: 'template', notes: [] }
  } as PageRecord
  const ld = reportJsonLd(page, 'https://site/x', 'https://site', 'Site')

  it('describes the page as an Article with breadcrumbs and a ranked list', () => {
    expect(ld['@graph'].map((g: { '@type': string }) => g['@type'])).toEqual(['Article', 'BreadcrumbList', 'ItemList'])
    const list = ld['@graph'][2] as any
    expect(list.numberOfItems).toBe(2)
    expect(list.itemListElement[0].item.location).toEqual({ '@type': 'Place', name: 'London' })
  })

  it('cannot be broken out of once escaped the way the page does it', () => {
    const html = JSON.stringify(ld).replace(/</g, '\\u003c')
    expect(html).not.toContain('</script>')
    expect(JSON.parse(html)['@graph'][2].itemListElement[0].item.name).toBe('Acme </script><b>')
  })
})
