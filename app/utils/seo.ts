// Structured data (JSON-LD) for a report page: what search engines read to
// understand it as an article, where it sits in the site, and the ranked list.
import type { PageRecord } from '#shared/page'
import { sentenceCase } from '#shared/format'

/** Matches the breadcrumb shown on the page: "Fintech", "AI". */
const crumbName = (industry: string) => sentenceCase(industry.charAt(0).toUpperCase() + industry.slice(1))

export function reportJsonLd(page: PageRecord, url: string, siteUrl: string, siteName: string) {
  const { companies } = page.data
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
        image: { '@type': 'ImageObject', url: `${siteUrl}/og.png`, width: 1200, height: 630 },
        author: { '@type': 'Organization', name: siteName, url: siteUrl },
        publisher: { '@type': 'Organization', name: siteName, url: siteUrl },
        about: { '@type': 'Thing', name: `${page.subject.industry} companies in ${page.subject.geography}` },
        mainEntity: { '@id': `${url}#ranking` }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Reports', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: crumbName(page.subject.industry), item: url }
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
            ...(c.region && { location: { '@type': 'Place', name: c.region } }),
            ...(c.founded && { foundingDate: String(c.founded) }),
            ...(c.size && c.size.max !== null && { numberOfEmployees: { '@type': 'QuantitativeValue', minValue: c.size.min, maxValue: c.size.max } })
          }
        }))
      }
    ]
  }
}
