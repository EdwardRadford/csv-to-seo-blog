<script setup lang="ts">
import type { Company, Currency, Dataset } from '#shared/types'
import { compactMoney, fullMoney } from '#shared/format'

// The full ranking. Sorting uses links (?sort=amount&order=asc), so it works
// without JavaScript and every sort order is still server-rendered.
const props = defineProps<{
  companies: Company[]
  has: Dataset['has']
  currency: Currency
  metric: string
  caption: string
}>()

type Key = 'rank' | 'name' | 'region' | 'stage' | 'size' | 'founded' | 'amount'
const route = useRoute()
const sort = computed<Key>(() => (['rank', 'name', 'region', 'stage', 'size', 'founded', 'amount'].includes(String(route.query.sort)) ? (route.query.sort as Key) : 'rank'))
const order = computed(() => (route.query.order === 'desc' ? 'desc' : 'asc'))

// A column where every row says the same thing ("Seed" x 100) adds nothing; the title already says it.
const showStage = computed(() => props.has.stage && new Set(props.companies.map((c) => c.stage)).size > 1)

const columns = computed(() =>
  ([
    { key: 'rank', label: 'Rank', show: true },
    { key: 'name', label: 'Company', show: true },
    { key: 'region', label: 'Location', show: props.has.region },
    { key: 'stage', label: 'Stage', show: showStage.value },
    { key: 'size', label: 'Employees', show: props.has.size },
    { key: 'founded', label: 'Founded', show: props.has.founded },
    { key: 'amount', label: props.metric, show: props.has.amount }
  ] as { key: Key; label: string; show: boolean }[]).filter((c) => c.show)
)

const value = (c: Company, key: Key): string | number => {
  switch (key) {
    case 'size': return c.size?.min ?? -1
    case 'amount': return c.amount ?? -1
    case 'founded': return c.founded ?? 0
    case 'rank': return c.rank
    default: return (c[key] ?? '').toString().toLowerCase()
  }
}

const rows = computed(() => {
  const direction = order.value === 'desc' ? -1 : 1
  return [...props.companies].sort((a, b) => {
    const x = value(a, sort.value)
    const y = value(b, sort.value)
    return (x < y ? -1 : x > y ? 1 : a.rank - b.rank) * direction
  })
})

// Clicking the current column flips the order; a new column starts in its natural order.
const linkFor = (key: Key) => {
  const natural = key === 'amount' || key === 'size' ? 'desc' : 'asc'
  const next = sort.value === key ? (order.value === 'asc' ? 'desc' : 'asc') : natural
  return { query: { ...route.query, sort: key, order: next }, hash: '#ranking' }
}
const ariaSort = (key: Key) => (sort.value === key ? (order.value === 'asc' ? 'ascending' : 'descending') : 'none')
const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
</script>

<template>
  <div class="scroller" tabindex="0" role="region" :aria-label="caption">
    <table>
      <caption class="visually-hidden">{{ caption }}. Column headers sort the table.</caption>
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" scope="col" :aria-sort="ariaSort(col.key)" :class="col.key">
            <NuxtLink :to="linkFor(col.key)" rel="nofollow" :class="{ active: sort === col.key }">
              {{ col.label }}
              <span aria-hidden="true" class="arrow">{{ sort === col.key ? (order === 'asc' ? '↑' : '↓') : '↕' }}</span>
            </NuxtLink>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in rows" :key="c.rank + c.name">
          <td class="rank num">{{ c.rank }}</td>
          <th scope="row" class="name">
            <a v-if="c.website" :href="c.website" rel="nofollow noopener" target="_blank">{{ c.name }}<span class="visually-hidden"> (opens {{ host(c.website) }} in a new tab)</span></a>
            <span v-else>{{ c.name }}</span>
            <span v-if="c.description" class="desc">{{ c.description }}</span>
          </th>
          <td v-if="has.region">{{ c.region ?? '–' }}</td>
          <td v-if="showStage">{{ c.stage ?? '–' }}</td>
          <td v-if="has.size" class="num">{{ c.size?.label ?? '–' }}</td>
          <td v-if="has.founded" class="num">{{ c.founded ?? '–' }}</td>
          <td v-if="has.amount" class="amount num">
            <template v-if="c.amount !== null">
              <span class="compact">{{ compactMoney(c.amount, currency) }}</span>
              <span class="full">{{ fullMoney(c.amount, currency) }}</span>
            </template>
            <span v-else>–</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.scroller { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); }
table { width: 100%; border-collapse: collapse; font-size: var(--step--1); min-width: 640px; }
th, td { padding: 12px 14px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
tbody tr:last-child > * { border-bottom: 0; }
thead th { position: sticky; top: 0; background: var(--surface); font-weight: 600; white-space: nowrap; z-index: 1; }
thead a { color: var(--muted); text-decoration: none; display: inline-flex; gap: 4px; }
thead a.active, thead a:hover { color: var(--ink); }
.arrow { color: var(--faint); }
a.active .arrow { color: var(--accent); }
tbody tr:hover > * { background: var(--surface); }

/* Keep rank and company visible while the rest scrolls sideways on a phone. */
.rank { width: 3.5rem; color: var(--muted); position: sticky; left: 0; background: var(--bg); }
.name { position: sticky; left: 3.5rem; background: var(--bg); font-weight: 600; min-width: 220px; max-width: 360px; }
thead .rank, thead .name { background: var(--surface); z-index: 2; }
.name a { color: var(--ink); }
.name a:hover { color: var(--accent); }
.desc { display: block; font-weight: 400; color: var(--muted); margin-top: 4px; line-height: 1.45; }
.amount { text-align: right; white-space: nowrap; }
thead .amount { text-align: right; }
.compact { font-weight: 600; display: block; }
.full { color: var(--faint); font-size: 0.8rem; }
</style>
