// Every number on a generated page comes from here. The AI never calculates
// anything: it receives these figures as finished text and writes around them.
import type { Company, Currency, Dataset } from './types'
import { compactMoney, count, percent } from './format'

export interface Group {
  label: string
  count: number
  share: number
  amount: number
}

export interface Stats {
  companies: number
  currency: Currency
  withAmount: number
  total: number | null
  mean: number | null
  median: number | null
  /** The amount the last-placed company raised: the bar for making the list. */
  threshold: number | null
  leader: { name: string; amount: number | null } | null
  top5Share: number | null
  top10Share: number | null
  regions: Group[]
  stages: Group[]
  sizes: Group[]
  tags: Group[]
  founded: { median: number; earliest: number; latest: number; recentShare: number; recentFrom: number } | null
  /** Average raised per size band, only for bands with at least three companies. */
  amountBySize: { label: string; mean: number; count: number }[]
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

function groupBy(companies: Company[], labels: (c: Company) => string[]): Group[] {
  const groups = new Map<string, Group>()
  for (const company of companies) {
    for (const label of labels(company)) {
      const group = groups.get(label) ?? { label, count: 0, share: 0, amount: 0 }
      group.count++
      group.amount += company.amount ?? 0
      groups.set(label, group)
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, share: g.count / companies.length }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount || a.label.localeCompare(b.label))
}

export function computeStats(data: Dataset, now = new Date()): Stats {
  const { companies, currency } = data
  const amounts = companies.map((c) => c.amount).filter((a): a is number => a !== null)
  const byAmount = [...amounts].sort((a, b) => b - a)
  const total = amounts.length ? amounts.reduce((a, b) => a + b, 0) : null
  const topShare = (n: number) => (total && amounts.length > n ? byAmount.slice(0, n).reduce((a, b) => a + b, 0) / total : null)
  const leader = companies[0] ? { name: companies[0].name, amount: companies[0].amount } : null

  const sizes = groupBy(companies, (c) => (c.size ? [c.size.label] : []))
  const sizeMin = new Map(companies.filter((c) => c.size).map((c) => [c.size!.label, c.size!.min]))
  sizes.sort((a, b) => (sizeMin.get(a.label) ?? 0) - (sizeMin.get(b.label) ?? 0))

  // Only a banded size column makes a meaningful "average raised per band".
  const banded = companies.some((c) => c.size && c.size.min !== c.size.max)
  const amountBySize = banded
    ? sizes
        .map((s) => {
          const inBand = companies.filter((c) => c.size?.label === s.label && c.amount !== null)
          return { label: s.label, count: inBand.length, mean: inBand.reduce((sum, c) => sum + c.amount!, 0) / Math.max(1, inBand.length) }
        })
        .filter((s) => s.count >= 3)
    : []

  const years = companies.map((c) => c.founded).filter((y): y is number => y !== null)
  const recentFrom = now.getFullYear() - 5
  const founded = years.length
    ? {
        median: Math.round(median(years)),
        earliest: Math.min(...years),
        latest: Math.max(...years),
        recentShare: years.filter((y) => y >= recentFrom).length / years.length,
        recentFrom
      }
    : null

  return {
    companies: companies.length,
    currency,
    withAmount: amounts.length,
    total,
    mean: total !== null ? total / amounts.length : null,
    median: amounts.length ? median(amounts) : null,
    threshold: byAmount.length ? byAmount.at(-1)! : null,
    leader,
    top5Share: topShare(5),
    top10Share: topShare(10),
    regions: groupBy(companies, (c) => (c.region ? [c.region] : [])),
    stages: groupBy(companies, (c) => (c.stage ? [c.stage] : [])),
    sizes,
    tags: groupBy(companies, (c) => c.tags).slice(0, 10),
    founded,
    amountBySize
  }
}

export interface Fact {
  key: string
  text: string
}

/**
 * The stats as short sentences with the numbers already formatted.
 * These are the only figures the AI is allowed to use, and the validator
 * checks every number in its copy against them.
 */
export function factsFrom(stats: Stats, labels: { metric: string }): Fact[] {
  const money = (v: number) => compactMoney(v, stats.currency)
  // Plain English for the amount: "has raised £30.3m" reads better than "has total raised of £30.3m".
  const raised = /rais|fund|equity|invest/i.test(labels.metric)
  const has = (v: number) => (raised ? `has raised ${money(v)}` : `has ${labels.metric.toLowerCase()} of ${money(v)}`)
  const facts: Fact[] = [{ key: 'companies', text: `The list has ${count(stats.companies)} companies.` }]
  const push = (key: string, text: string) => facts.push({ key, text })
  // "A and B are joint most common" when the top two groups are level, rather than picking one.
  const leaders = (groups: Group[]) => groups.filter((g) => g.count === groups[0]?.count)
  const names = (groups: Group[]) => groups.map((g) => g.label).join(' and ')

  if (stats.total !== null) {
    push('total', `Between them, the companies ${raised ? 'have raised' : `have ${labels.metric.toLowerCase()} of`} ${money(stats.total)}.`)
    push('median', `The median company ${has(stats.median!)}; the mean is ${money(stats.mean!)}.`)
    push('threshold', `The company in last place ${has(stats.threshold!)}, the minimum needed to make the list.`)
  }
  if (stats.leader?.amount != null) push('leader', `${stats.leader.name} ranks first and ${has(stats.leader.amount)}.`)
  else if (stats.leader) push('leader', `${stats.leader.name} ranks first.`)
  if (stats.top10Share !== null) push('top10', `The top 10 companies account for ${percent(stats.top10Share)} of the total.`)
  if (stats.top5Share !== null) push('top5', `The top 5 companies account for ${percent(stats.top5Share)} of the total.`)

  const topRegions = leaders(stats.regions)
  if (topRegions.length === 1) {
    const top = topRegions[0]!
    push('region_top', `${top.label} is home to ${count(top.count)} of the companies (${percent(top.share)}).`)
    const second = leaders(stats.regions.slice(1))
    if (second.length) push('region_second', `${names(second)} ${second.length > 1 ? 'are joint second' : 'is second'} with ${count(second[0]!.count)} each.`.replace(' each.', second.length > 1 ? ' each.' : '.'))
    const outside = stats.companies - top.count
    if (outside > 0) push('region_outside', `${count(outside)} companies are based outside ${top.label}.`)
  } else if (topRegions.length > 1) {
    push('region_top', `${names(topRegions)} are level, with ${count(topRegions[0]!.count)} companies each.`)
  }
  if (stats.regions.length > 1) push('region_count', `In total, the companies are spread across ${count(stats.regions.length)} locations.`)

  if (stats.stages.length === 1) push('stage_all', `All ${count(stats.stages[0]!.count)} companies with a known stage are at ${stats.stages[0]!.label} stage.`)
  else if (stats.stages.length > 1) {
    const top = leaders(stats.stages)
    push('stage_top', top.length > 1
      ? `${names(top)} are the joint most common stages, with ${count(top[0]!.count)} companies each.`
      : `${top[0]!.label} is the most common stage, with ${count(top[0]!.count)} companies.`)
  }

  // "Most common size" only means something for bands ("10-24"), not exact headcounts.
  if (stats.amountBySize.length) {
    const top = leaders([...stats.sizes].sort((a, b) => b.count - a.count))
    push('size_common', top.length > 1
      ? `The most common team sizes are ${names(top)} employees, with ${count(top[0]!.count)} companies each.`
      : `The most common team size is ${top[0]!.label} employees (${count(top[0]!.count)} companies).`)
  }
  const biggestBand = [...stats.amountBySize].sort((a, b) => b.mean - a.mean)[0]
  if (biggestBand) push('size_amount', `Companies with ${biggestBand.label} employees have the highest average, at ${money(biggestBand.mean)}.`)

  // A tag nearly every company has ("Application software" on 98 of 100) says nothing, so skip it.
  stats.tags.filter((t) => t.share <= 0.9).slice(0, 3).forEach((tag, i) => push(`tag_${i + 1}`, `${count(tag.count)} companies are classed as "${tag.label}".`))

  if (stats.founded) {
    const f = stats.founded
    push('founded_median', `The median founding year is ${f.median}; the oldest company was founded in ${f.earliest}.`)
    push('founded_recent', `${percent(f.recentShare)} were founded in ${f.recentFrom} or later.`)
  }
  return facts
}
