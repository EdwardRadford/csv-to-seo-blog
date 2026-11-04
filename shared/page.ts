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
  /** Random secret returned only to the uploader; needed to delete or regenerate. Never sent to readers. */
  editToken?: string
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
  total: number | null
  currency: Dataset['currency']
  /** Amounts in rank order, scaled 0 to 1, for the little funding curve on index cards. */
  curve: number[]
}

export const summarise = (page: PageRecord): PageSummary => ({
  slug: page.slug,
  title: page.title,
  industry: page.subject.industry,
  companies: page.data.companies.length,
  createdAt: page.createdAt,
  updatedAt: page.updatedAt,
  noindex: page.noindex,
  total: page.stats.total,
  currency: page.data.currency,
  curve: curveOf(page.data.companies.map((c) => c.amount ?? 0))
})

function curveOf(amounts: number[]): number[] {
  const max = Math.max(1, ...amounts)
  return amounts.slice(0, 40).map((a) => Math.round((a / max) * 100) / 100)
}
