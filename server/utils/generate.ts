// The whole CSV-to-page pipeline in one place:
// parse -> profile -> map columns -> clean -> stats -> AI copy -> save.
import type { H3Event } from 'h3'
import type { Mapping, Role } from '#shared/types'
import { ROLES } from '#shared/types'
import { analyseCsv } from '#shared/csv'
import { buildDataset } from '#shared/csv/normalise'
import { fallbackCopy, pageTitle, type Subject } from '#shared/copy'
import type { PageRecord } from '#shared/page'
import { metricLabel, slugify } from '#shared/format'
import { computeStats, factsFrom } from '#shared/stats'
import { industryFromFilename, writeCopy } from './ai'
import { freeSlug, getPage, savePage, takeDailyGeneration } from './store'

// Each generation uses one to three AI calls, and the free tier allows about 20 a day per model.
export const DAILY_AI_LIMIT = 40

export interface GenerateInput {
  csv: string
  filename: string
  /** Header chosen for each role on the preview screen. Missing roles fall back to the rules. */
  mapping?: Partial<Record<Role, string | null>>
  industry?: string
  geography?: string
  noindex?: boolean
}

export function apiKey(event: H3Event): string {
  return useRuntimeConfig(event).geminiApiKey as string
}

/** Turns the preview screen's header names back into column positions. */
export function resolveMapping(headers: string[], chosen: GenerateInput['mapping'], fallback: Mapping): Mapping {
  const mapping = { ...fallback }
  if (!chosen) return mapping
  for (const role of ROLES) {
    if (!(role in chosen)) continue
    const header = chosen[role]
    if (header === null || header === '') { mapping[role] = null; continue }
    const index = headers.indexOf(header!)
    if (index === -1) throw createError({ statusCode: 400, statusMessage: `Unknown column "${header}" for ${role}.` })
    mapping[role] = index
  }
  if (mapping.name === null) throw createError({ statusCode: 400, statusMessage: 'Choose which column holds the company name.' })
  return mapping
}

function subjectFor(input: { industry?: string; geography?: string; filename: string }, metric: string, stages: { label: string }[]): Subject {
  // Strip anything that isn't a plain label, since this text goes into the title, URL and AI prompt.
  const clean = (text: string | undefined) => (text ?? '').replace(/[^\p{L}\p{N}\s&'.-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
  const industry = clean(input.industry) || industryFromFilename(input.filename) || 'company'
  // When every company is at one stage, say so in the title, as Beauhurst does.
  const qualifier = stages.length === 1 ? `${stages[0]!.label.toLowerCase()}-stage` : null
  return { industry, geography: clean(input.geography) || 'UK', qualifier, metric, year: new Date().getFullYear() }
}

async function contentFor(event: H3Event, subject: Subject, page: Pick<PageRecord, 'data' | 'stats'>) {
  const facts = factsFrom(page.stats, { metric: subject.metric })
  if (!(await takeDailyGeneration(DAILY_AI_LIMIT))) {
    return { copy: fallbackCopy(subject, page.stats, page.data), source: 'template' as const, notes: ['Daily AI limit reached, so template copy was used.'] }
  }
  return writeCopy(apiKey(event), subject, page.stats, facts, page.data)
}

export async function generatePage(event: H3Event, input: GenerateInput): Promise<PageRecord> {
  const { csv, profiles, match } = analyseCsv(input.csv)
  const mapping = resolveMapping(csv.headers, input.mapping, match.mapping)
  const data = buildDataset(csv, profiles, mapping)
  const stats = computeStats(data)
  const subject = subjectFor(input, metricLabel(data.columns.amount ?? 'Funding'), stats.stages)
  const content = await contentFor(event, subject, { data, stats })

  const title = pageTitle(subject, data.companies.length)
  const now = new Date().toISOString()
  const page: PageRecord = {
    slug: await freeSlug(slugify(title.replace(/\|/g, ''))),
    title,
    subject,
    createdAt: now,
    updatedAt: now,
    noindex: Boolean(input.noindex),
    editToken: crypto.randomUUID(),
    source: { filename: input.filename.slice(0, 120), rows: csv.rows.length, columns: data.columns, warnings: data.warnings },
    data,
    stats,
    content
  }
  await savePage(page)
  return page
}

/** Rewrites the copy for an existing page from its stored data; no re-upload needed. */
export async function regeneratePage(event: H3Event, slug: string): Promise<PageRecord> {
  const page = await getPage(slug)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  const subject = { ...page.subject, metric: metricLabel(page.subject.metric), year: new Date().getFullYear() }
  const stats = computeStats(page.data)
  const content = await contentFor(event, subject, { data: page.data, stats })
  if (content.source === 'template' && page.content.source === 'ai') {
    throw createError({ statusCode: 503, statusMessage: 'The AI is unavailable right now, so the existing copy was kept. Please try again later.' })
  }
  const updated: PageRecord = { ...page, subject, stats, content, updatedAt: new Date().toISOString() }
  await savePage(updated)
  return updated
}
