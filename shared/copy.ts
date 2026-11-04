// The AI-written part of a page: what we ask for, how we check it, and the
// template copy used when the AI is unavailable or its answer fails the checks.
import type { Fact, Stats } from './stats'
import type { Dataset } from './types'
import { compactMoney, count, percent } from './format'

export interface PageCopy {
  metaDescription: string
  intro: string
  overview: string[]
  keyFindings: string[]
  locations: string | null
  outlook: string[]
  faq: { question: string; answer: string }[]
}

export interface Subject {
  /** e.g. "fintech", "healthtech". */
  industry: string
  /** e.g. "UK", "Europe". */
  geography: string
  /** e.g. "seed-stage", when every company shares one stage. */
  qualifier: string | null
  /** The amount column's header, e.g. "Total Raised". */
  metric: string
  year: number
}

/** JSON schema sent to Gemini, so it can only answer in this shape. */
export const COPY_SCHEMA = {
  type: 'object',
  properties: {
    metaDescription: { type: 'string', description: '130 to 155 characters. Includes the industry, the location and one striking figure.' },
    intro: { type: 'string', description: 'One paragraph of 45 to 70 words that opens with the headline figure.' },
    overview: { type: 'array', items: { type: 'string' }, description: 'Two paragraphs about the shape of this list.' },
    keyFindings: { type: 'array', items: { type: 'string' }, description: 'Four to six one-sentence findings, each built on one fact.' },
    locations: { type: 'string', description: 'One paragraph on where the companies are based. Empty string if there is no location data.' },
    outlook: { type: 'array', items: { type: 'string' }, description: 'One or two paragraphs on what the data suggests for the sector. No new numbers.' },
    faq: {
      type: 'array',
      items: {
        type: 'object',
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
        required: ['question', 'answer']
      },
      description: 'Four or five questions a searcher would ask, answered in one or two sentences from the facts.'
    }
  },
  required: ['metaDescription', 'intro', 'overview', 'keyFindings', 'locations', 'outlook', 'faq']
} as const

export const SYSTEM_PROMPT = `You write data-led blog copy for a UK company-intelligence publisher.
Rules:
- British English. Plain, factual and specific. No hype words (revolutionary, game-changing, thriving, robust, landscape, delve, unlock, cutting-edge, ecosystem, empower, unleash, transform, supercharge, leverage, seamless, elevate).
- Use ONLY the numbers given in FACTS, written exactly as they appear there. Do not calculate, round differently, estimate or add any other number, year or percentage.
- Keep each number attached to what its fact says it measures. Never reuse a figure to describe something else.
- Describe what the data shows, not why. No claims about investor sentiment, demand, momentum or causes. The outlook says what to watch, framed as open questions the data raises.
- Do not name any company that is not in the TOP COMPANIES list. Do not invent investors, products, events or trends.
- Mention the industry and location naturally for search, but never stuff keywords.
- Plain text only: no markdown, no HTML, no emojis. Never use an em dash or en dash; use a comma, a full stop or a plain hyphen.`

export function buildPrompt(subject: Subject, facts: Fact[], data: Dataset): string {
  const top = data.companies.slice(0, 10).map((c) => {
    const parts = [`${c.rank}. ${c.name}`]
    if (c.description) parts.push(`- ${c.description.slice(0, 160)}`)
    return parts.join(' ')
  })
  const scope = [subject.qualifier, subject.industry].filter(Boolean).join(' ')
  return `Write the copy for a ranking page: "the top ${data.companies.length} ${scope} companies in ${place(subject.geography)}", ranked by ${subject.metric.toLowerCase()}.

FACTS (the only numbers you may use):
${facts.map((f) => `- ${f.text}`).join('\n')}

TOP COMPANIES (the only companies you may name):
${top.join('\n')}

Location data available: ${data.has.region ? 'yes' : 'no'}.`
}

/** "UK" reads as "the UK"; "Europe" stays as it is. */
export function place(geography: string): string {
  return /^(uk|us|usa|united kingdom|united states|netherlands|uae)$/i.test(geography.trim()) ? `the ${geography.trim()}` : geography.trim()
}

// ---------- Checking the AI's answer ----------

const UNIT: Record<string, number> = { k: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 }
const NUMBER = /(?<![\p{L}\d.])([£$€])?\s?(\d[\d,]*(?:\.\d+)?)\s?(%|k\b|mn\b|m\b|million\b|bn\b|b\b|billion\b)?/giu

interface NumberToken { text: string; value: number; percent: boolean; tolerance: number }

/** Finds every number in a text, with how precisely it was written. */
export function numbersIn(text: string): NumberToken[] {
  const tokens: NumberToken[] = []
  for (const match of text.matchAll(NUMBER)) {
    const [whole, , digits, unitText] = match
    const unit = unitText?.toLowerCase()
    const clean = digits!.replace(/,/g, '')
    const decimals = clean.includes('.') ? clean.split('.')[1]!.length : 0
    const multiplier = unit && unit !== '%' ? UNIT[unit]! : 1
    tokens.push({
      text: whole!.trim(),
      value: Number(clean) * multiplier,
      percent: unit === '%',
      // "£30m" is fine for £30.3m; "£31m" is not. Half of the last written digit.
      tolerance: 0.5 * Math.pow(10, -decimals) * multiplier
    })
  }
  return tokens
}

export interface CheckResult { ok: boolean; problems: string[] }

/**
 * Rejects copy that uses any number not in the facts, names a company outside
 * the dataset in a ranking claim, or misses the shape we asked for.
 */
export function checkCopy(copy: PageCopy, facts: Fact[], data: Dataset, extra: number[] = []): CheckResult {
  const problems: string[] = []
  // The page year (and anything else the caller vouches for) is allowed too.
  const allowed = [...facts.flatMap((f) => numbersIn(f.text)), ...extra.map((value) => ({ text: String(value), value, percent: false, tolerance: 0 }))]
  const names = data.companies.map((c) => c.name).sort((a, b) => b.length - a.length)

  const texts = [copy.metaDescription, copy.intro, ...copy.overview, ...copy.keyFindings, copy.locations ?? '', ...copy.outlook, ...copy.faq.flatMap((f) => [f.question, f.answer])]
  for (const raw of texts) {
    // Numbers inside company names ("1Password") are not claims.
    let text = raw
    for (const name of names) text = text.split(name).join(' ')
    for (const token of numbersIn(text)) {
      const fine = allowed.some((a) => a.percent === token.percent && Math.abs(a.value - token.value) <= Math.max(token.tolerance, a.tolerance))
      if (!fine) problems.push(`"${token.text}" is not one of the given figures`)
    }
    if (/[*#<>`]|\]\(/.test(raw)) problems.push('contains markdown or HTML')
    if (/[–—]/.test(raw)) problems.push('contains an en or em dash')
  }

  const meta = copy.metaDescription.length
  if (meta < 70 || meta > 170) problems.push(`meta description is ${meta} characters (want 130 to 155)`)
  if (copy.keyFindings.length < 3) problems.push('fewer than three key findings')
  if (copy.faq.length < 3) problems.push('fewer than three FAQs')
  if (!copy.intro.trim() || copy.overview.length === 0) problems.push('missing intro or overview')

  return { ok: problems.length === 0, problems: [...new Set(problems)] }
}

// ---------- Template copy, used when the AI can't be ---------

export function fallbackCopy(subject: Subject, stats: Stats, data: Dataset): PageCopy {
  const money = (v: number) => compactMoney(v, stats.currency)
  const scope = [subject.qualifier, subject.industry].filter(Boolean).join(' ')
  const where = place(subject.geography)
  const n = count(stats.companies)
  const top = stats.regions[0]
  const metric = subject.metric.toLowerCase()

  const headline = stats.total !== null
    ? `The ${n} ${scope} companies in ${where} on this list have a combined ${metric} of ${money(stats.total)}.`
    : `This list ranks ${n} ${scope} companies in ${where}.`

  const findings: string[] = []
  if (stats.leader?.amount != null) findings.push(`${stats.leader.name} ranks first with ${money(stats.leader.amount)}.`)
  if (stats.top10Share !== null) findings.push(`The top 10 companies account for ${percent(stats.top10Share)} of the total.`)
  if (stats.median !== null) findings.push(`The median company on the list has ${money(stats.median)}.`)
  if (top) findings.push(`${top.label} is home to ${count(top.count)} of the ${n} companies.`)
  if (stats.tags[0]) findings.push(`"${stats.tags[0].label}" is the most common category, covering ${count(stats.tags[0].count)} companies.`)
  if (stats.founded) findings.push(`${percent(stats.founded.recentShare)} were founded in ${stats.founded.recentFrom} or later.`)

  const faq: PageCopy['faq'] = [
    { question: `How are these ${scope} companies ranked?`, answer: `By ${metric}, highest first, using the figures in the dataset.` }
  ]
  if (stats.leader) faq.push({ question: `Which ${scope} company ranks first?`, answer: `${stats.leader.name}${stats.leader.amount != null ? `, with ${money(stats.leader.amount)}` : ''}.` })
  if (top) faq.push({ question: `Where are most of these companies based?`, answer: `${top.label}, with ${count(top.count)} of the ${n} companies.` })
  if (stats.threshold !== null) faq.push({ question: 'What does it take to make the list?', answer: `The company in last place has ${money(stats.threshold)}.` })

  return {
    metaDescription: clip(`${capitalise(n)} ${scope} companies in ${where}, ranked by ${metric}.${stats.total !== null ? ` Combined total ${money(stats.total)}.` : ''} Key findings, regions and the full table.`, 160),
    intro: `${headline} This page ranks every one of them and pulls out what the numbers say about the sector.`,
    overview: [
      stats.top10Share !== null
        ? `Funding is concentrated at the top: the ten best-funded companies account for ${percent(stats.top10Share)} of the total, while the median company has ${money(stats.median!)}.`
        : `The table below lists every company in the dataset.`
    ],
    keyFindings: findings,
    locations: top ? `${top.label} leads with ${count(top.count)} companies (${percent(top.share)}), and ${count(stats.companies - top.count)} are based elsewhere.` : null,
    outlook: [`This ranking is a snapshot of the dataset as uploaded. Regenerate the page when the data changes to keep the figures current.`],
    faq
  }
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}.`)

/** Fixed title formula, matching how Beauhurst titles its own lists. */
export function pageTitle(subject: Subject, companies: number): string {
  const scope = [subject.qualifier, subject.industry].filter((part): part is string => Boolean(part)).map(titleCase).join(' ')
  return `Top ${companies} ${scope} Companies in ${titleCasePlace(place(subject.geography))} | ${subject.year}`
}

const ACRONYMS = new Set(['ai', 'iot', 'ml', 'vr', 'ar', 'saas', 'b2b', 'b2c', 'esg', 'uk', 'eu', 'us'])
const titleCase = (text: string) =>
  text.replace(/[\p{L}\d]+/gu, (word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
const titleCasePlace = (text: string) => text.replace(/^the /, 'the ')
