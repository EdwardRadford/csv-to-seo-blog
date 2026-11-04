// Structured data (JSON-LD) for a report page: what search engines read to
// understand it as an article, where it sits in the site, and the ranked list.
import type { PageRecord } from '#shared/page'
import { fullMoney, metricLabel } from '#shared/format'

export function reportJsonLd(page: PageRecord, url: string, siteUrl: string, siteName: string) {
  const { companies, currency } = page.data
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: page.title.slice(0, 110),
        description: page.content.copy.metaDescription,
        datePublished: page.createdAt,
        dateModified: page.updatedAt,
        inLanguage: 'en-GB',
        mainEntityOfPage: url,
        author: { '@type': 'Organization', name: siteName, url: siteUrl },
        publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
        about: { '@type': 'Thing', name: `${page.subject.industry} companies in ${page.subject.geography}` },
        mainEntity: { '@id': `${url}#ranking` }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Reports', item: siteUrl },
          { '@type': 'ListItem', position: 2, name: page.title, item: url }
        ]
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#ranking`,
        name: page.title,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: companies.length,
        itemListElement: companies.map((c) => ({
          '@type': 'ListItem',
          position: c.rank,
          item: {
            '@type': 'Organization',
            name: c.name,
            ...(c.website && { url: c.website }),
            ...(c.description && { description: c.description }),
            ...(c.region && { location: c.region }),
            ...(c.founded && { foundingDate: String(c.founded) }),
            ...(c.size && c.size.max !== null && { numberOfEmployees: { '@type': 'QuantitativeValue', minValue: c.size.min, maxValue: c.size.max } }),
            additionalProperty: [
              ...(c.stage ? [{ '@type': 'PropertyValue', name: 'Stage', value: c.stage }] : []),
              ...(c.amount !== null ? [{ '@type': 'PropertyValue', name: metricLabel(page.subject.metric), value: fullMoney(c.amount, currency) }] : [])
            ]
          }
        }))
      }
    ]
  }
}
