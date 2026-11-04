import type { ColumnProfile, ColumnType, Mapping, Role } from '../types'
import { ROLES } from '../types'

interface RoleRule {
  /** Header patterns, strongest first. An exact match scores higher than a partial one. */
  exact: RegExp
  partial?: RegExp
  /** The column types this role can take. */
  types: ColumnType[]
}

// Rules for matching a header to a role. The AI is only asked about columns these miss.
export const RULES: Record<Role, RoleRule> = {
  name: {
    exact: /^(company|company name|name|startup|startup name|organisation|organization|business|business name|firm|brand)$/i,
    partial: /company|startup|organi[sz]ation|business name|\bname\b/i,
    types: ['text', 'category']
  },
  rank: {
    exact: /^(rank|ranking|position|pos|#|no\.?|number)$/i,
    partial: /\brank|position/i,
    types: ['number']
  },
  amount: {
    exact: /^(total raised|amount raised|total funding|funding|raised|total equity raised|equity raised|investment|total investment)$/i,
    partial: /rais|fund|equity|invest|capital|amount|valuation|revenue/i,
    types: ['money', 'number']
  },
  region: {
    exact: /^(region|location|city|country|hq|headquarters|hq city|county|area)$/i,
    partial: /region|location|city|country|\bhq\b|headquarter|county/i,
    types: ['category', 'text']
  },
  stage: {
    exact: /^(stage|funding stage|company stage|growth stage|phase)$/i,
    partial: /stage|series|phase|round|deal/i,
    types: ['category']
  },
  size: {
    exact: /^(employees|employee count|headcount|staff|team size|size|people|workforce|number of employees)$/i,
    partial: /employ|headcount|staff|team|workforce/i,
    types: ['band', 'number']
  },
  description: {
    exact: /^(description|about|summary|overview|bio|what they do)$/i,
    partial: /descri|about|summary|overview/i,
    types: ['text', 'category']
  },
  website: {
    exact: /^(website|url|site|domain|web|homepage|link)$/i,
    partial: /web|url|site|domain|homepage/i,
    types: ['url']
  },
  tags: {
    exact: /^(industries|industry|sectors|sector|tags|categories|category|focus|focus areas|verticals|subsectors|keywords|buzzwords)$/i,
    partial: /industr|sector|tag|categor|focus|vertical|market|keyword|buzzword/i,
    types: ['list', 'category', 'text']
  },
  founded: {
    exact: /^(founded|year founded|founded year|established|incorporated|year)$/i,
    partial: /found|establish|incorporat|\best\b|\bestd\b|\byear\b/i,
    types: ['year']
  }
}

// The order roles claim columns in. Specific roles go first, so a generic
// "name" pattern can't take a column that is clearly a website or a stage.
const CLAIM_ORDER: Role[] = ['website', 'rank', 'amount', 'founded', 'size', 'stage', 'region', 'tags', 'description', 'name']

export type MatchSource = 'header' | 'type' | 'ai' | 'user'

export interface RoleMatch {
  mapping: Mapping
  /** How each role was matched, for the preview screen and the methodology. */
  source: Partial<Record<Role, MatchSource>>
  /** Columns no rule claimed. These are what the AI gets asked about. */
  unmatched: number[]
}

export const emptyMapping = (): Mapping =>
  Object.fromEntries(ROLES.map((role) => [role, null])) as Mapping

function headerScore(rule: RoleRule, header: string): number {
  const clean = header.trim().replace(/\s*\(.*?\)\s*/g, ' ').replace(/[_-]+/g, ' ').trim()
  if (rule.exact.test(clean)) return 2
  if (rule.partial?.test(clean)) return 1
  return 0
}

/** Matches columns to roles from their headers and types. */
export function matchRoles(profiles: ColumnProfile[]): RoleMatch {
  const mapping = emptyMapping()
  const source: RoleMatch['source'] = {}
  const used = new Set<number>()

  // Pass 1: header and type agree.
  for (const role of CLAIM_ORDER) {
    const rule = RULES[role]
    let best: { index: number; score: number } | null = null
    for (const profile of profiles) {
      if (used.has(profile.index) || !rule.types.includes(profile.type)) continue
      const score = headerScore(rule, profile.header)
      if (score > (best?.score ?? 0)) best = { index: profile.index, score }
    }
    if (best) {
      mapping[role] = best.index
      source[role] = 'header'
      used.add(best.index)
    }
  }

  // Pass 2: roles a column's type gives away even with an unhelpful header.
  const free = (type: ColumnType) => profiles.filter((p) => !used.has(p.index) && p.type === type)
  const claim = (role: Role, profile: ColumnProfile | undefined) => {
    if (!profile || mapping[role] !== null) return
    mapping[role] = profile.index
    source[role] = 'type'
    used.add(profile.index)
  }
  claim('website', free('url')[0])
  claim('amount', free('money')[0])
  claim('size', free('band')[0])
  claim('tags', free('list')[0])
  // The name is the unique text column with the shortest values (a description is unique too, but long).
  claim('name', profiles
    .filter((p) => !used.has(p.index) && (p.type === 'text' || p.type === 'category') && p.distinct >= p.count * 0.9)
    .sort((a, b) => avgLength(a) - avgLength(b))[0])
  // The description is the unclaimed text column with the longest values.
  claim('description', free('text').sort((a, b) => avgLength(b) - avgLength(a))[0])

  const unmatched = profiles.filter((p) => !used.has(p.index) && p.type !== 'empty').map((p) => p.index)
  return { mapping, source, unmatched }
}

const avgLength = (p: ColumnProfile) => p.examples.reduce((sum, e) => sum + e.length, 0) / Math.max(1, p.examples.length)
