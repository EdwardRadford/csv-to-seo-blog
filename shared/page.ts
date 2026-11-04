// The stored shape of a generated page. The three layers stay separate:
// `data` is the cleaned dataset, `stats` and `copy` are derived from it, and
// the Vue template decides how they look. Nothing here is fintech-specific.
import type { PageCopy, Subject } from './copy'
import type { Stats } from './stats'
import type { Dataset, Role } from './types'

export interface PageRecord {
  slug: string
  title: string
  subject: Subject
  createdAt: string
  updatedAt: string
  noindex: boolean
  source: {
    filename: string
    rows: number
    /** Header used for each role, so the methodology can say where figures came from. */
    columns: Partial<Record<Role, string>>
    warnings: string[]
  }
  data: Dataset
  stats: Stats
  content: {
    copy: PageCopy
    source: 'ai' | 'template'
    model?: string
    notes: string[]
  }
}

/** What the index keeps per page, enough for listings and the sitemap. */
export interface PageSummary {
  slug: string
  title: string
  industry: string
  companies: number
  createdAt: string
  updatedAt: string
  noindex: boolean
}

export const summarise = (page: PageRecord): PageSummary => ({
  slug: page.slug,
  title: page.title,
  industry: page.subject.industry,
  companies: page.data.companies.length,
  createdAt: page.createdAt,
  updatedAt: page.updatedAt,
  noindex: page.noindex
})
