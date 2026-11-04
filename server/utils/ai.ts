// The two jobs the AI does: fill gaps in the column mapping, and write the page copy.
// Both are checked in code before anything is used, and both have a non-AI fallback.
import type { ColumnProfile, Dataset, Mapping, Role } from '#shared/types'
import { ROLES } from '#shared/types'
import type { RoleMatch } from '#shared/csv/roles'
import { RULES } from '#shared/csv/roles'
import type { PageCopy, Subject } from '#shared/copy'
import { buildPrompt, checkCopy, COPY_SCHEMA, fallbackCopy, SYSTEM_PROMPT } from '#shared/copy'
import type { Fact, Stats } from '#shared/stats'
import { GeminiError, generateJson } from './gemini'

// ---------- Column mapping ----------

const MAPPING_SCHEMA = {
  type: 'object',
  properties: {
    industry: { type: 'string', description: 'Short lower-case name for the industry these companies are in, e.g. "fintech", "healthtech", "cleantech", "AI".' },
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          column: { type: 'string' },
          role: { type: 'string', enum: [...ROLES, 'none'] }
        },
        required: ['column', 'role']
      }
    }
  },
  required: ['industry', 'assignments']
} as const

export interface MappingResult {
  match: RoleMatch
  industry: string | null
  aiUsed: boolean
  aiError?: string
}

/**
 * Asks the AI about the columns the rules couldn't place, and for the industry name.
 * Rules always win: the AI can only fill a role that is still empty, and only
 * with a column whose type suits that role.
 */
export async function improveMapping(apiKey: string, profiles: ColumnProfile[], rules: RoleMatch, filename: string): Promise<MappingResult> {
  // Nothing to ask: every column is placed and the file name gives the industry. Skip the wait.
  const fromName = industryFromFilename(filename)
  if (rules.unmatched.length === 0 && fromName) return { match: rules, industry: fromName, aiUsed: false }

  const missing = ROLES.filter((role) => rules.mapping[role] === null)
  const describe = (p: ColumnProfile) => `- "${p.header}" (${p.type}; e.g. ${p.examples.map((e) => JSON.stringify(e.slice(0, 60))).join(', ')})`
  const prompt = `A company dataset was uploaded as "${filename}".
Columns already identified: ${ROLES.filter((r) => rules.mapping[r] !== null).map((r) => `${r} = "${profiles[rules.mapping[r]!]!.header}"`).join('; ')}.
Unplaced columns:
${rules.unmatched.map((i) => describe(profiles[i]!)).join('\n') || '(none)'}
Roles still empty: ${missing.join(', ') || '(none)'}.
For each unplaced column, give the empty role it fills, or "none" if it fits no role.
Roles: name = company name, rank = position in the list, amount = money raised or similar, region = location, stage = company or funding stage, size = employee count, description = what the company does, website = URL, tags = industries or sectors, founded = founding year.
Also give the industry the dataset covers, judged from the filename, descriptions and tags.
All columns, for context:
${profiles.map(describe).join('\n')}`

  try {
    const { data } = await generateJson<{ industry: string; assignments: { column: string; role: Role | 'none' }[] }>({
      apiKey,
      system: 'You label the columns of CSV files. Answer only from the evidence given.',
      prompt,
      schema: MAPPING_SCHEMA,
      // The user is waiting on this step, so one quick attempt; the rules already stand on their own.
      timeoutMs: 8_000,
      thinking: 'minimal',
      models: ['gemini-3.5-flash']
    })
    const mapping: Mapping = { ...rules.mapping }
    const source = { ...rules.source }
    const unmatched = new Set(rules.unmatched)
    for (const { column, role } of data.assignments ?? []) {
      if (role === 'none' || mapping[role] !== null) continue
      const profile = profiles.find((p) => p.header === column && unmatched.has(p.index))
      if (!profile || !RULES[role].types.includes(profile.type)) continue
      mapping[role] = profile.index
      source[role] = 'ai'
      unmatched.delete(profile.index)
    }
    const industry = cleanIndustry(data.industry)
    return { match: { mapping, source, unmatched: [...unmatched] }, industry, aiUsed: true }
  } catch (error) {
    return { match: rules, industry: null, aiUsed: false, aiError: error instanceof GeminiError ? error.reason : 'error' }
  }
}

function cleanIndustry(text: string | undefined): string | null {
  const clean = (text ?? '').trim().replace(/\s+companies$/i, '').replace(/[^\p{L}\p{N}\s&-]/gu, '').slice(0, 40)
  return clean || null
}

/** Guess from the file name when the AI can't help: "healthtech-uk-top-50.csv" gives "healthtech". */
export function industryFromFilename(filename: string): string | null {
  const stop = new Set(['uk', 'top', 'the', 'companies', 'company', 'list', 'data', 'dataset', 'europe', 'seed', 'csv', 'startups', 'final', 'export'])
  const word = filename.replace(/\.[a-z]+$/i, '').split(/[^a-z]+/i).find((w) => w.length > 1 && !stop.has(w.toLowerCase()))
  return word ? word.toLowerCase() : null
}

// ---------- Page copy ----------

export interface CopyResult {
  copy: PageCopy
  source: 'ai' | 'template'
  model?: string
  /** Why the template was used, or what the checker caught on the first try. */
  notes: string[]
}

export async function writeCopy(apiKey: string, subject: Subject, stats: Stats, facts: Fact[], data: Dataset): Promise<CopyResult> {
  const notes: string[] = []
  let prompt = buildPrompt(subject, facts, data)

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data: raw, model } = await generateJson<PageCopy>({ apiKey, system: SYSTEM_PROMPT, prompt, schema: COPY_SCHEMA, timeoutMs: 40_000, thinking: 'low' })
      const copy = tidy(raw, data.has.region)
      const check = checkCopy(copy, facts, data, [subject.year])
      if (check.ok) return { copy, source: 'ai', model, notes }
      notes.push(`Attempt ${attempt} failed the checks: ${check.problems.slice(0, 5).join('; ')}`)
      // Tell the model exactly what was wrong and ask once more.
      prompt = `${buildPrompt(subject, facts, data)}\n\nYour previous answer was rejected: ${check.problems.join('; ')}. Fix these and use only the figures in FACTS.`
    } catch (error) {
      notes.push(`AI unavailable (${error instanceof GeminiError ? error.reason : 'error'}).`)
      break
    }
  }
  return { copy: fallbackCopy(subject, stats, data), source: 'template', notes }
}

function tidy(copy: PageCopy, hasRegion: boolean): PageCopy {
  const line = (text: unknown) => String(text ?? '').replace(/\s+/g, ' ').trim()
  const list = (items: unknown) => (Array.isArray(items) ? items.map(line).filter(Boolean) : [])
  return {
    metaDescription: line(copy.metaDescription),
    intro: line(copy.intro),
    overview: list(copy.overview),
    keyFindings: list(copy.keyFindings),
    locations: hasRegion && line(copy.locations) ? line(copy.locations) : null,
    outlook: list(copy.outlook),
    faq: (Array.isArray(copy.faq) ? copy.faq : [])
      .map((f) => ({ question: line(f?.question), answer: line(f?.answer) }))
      .filter((f) => f.question && f.answer)
  }
}
